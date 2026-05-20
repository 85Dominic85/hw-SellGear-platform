import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PurchaseType, Product, UserRole } from '@/types/database'
import { cartTotals } from '@/lib/pricing'
import { canCreateOrder } from '@/lib/auth'
import { validateLineDiscount } from '@/lib/orders-validation'
import { upsertAddressFromOrder } from '@/lib/address-book/upsert'
import { isCanaryIslands } from '@/lib/utils'

const SHEET_TAB_MAP: Record<string, string> = {
  kit_digital: 'KIT Digital',
  hardware_one_off: 'Hardware One Off',
  hardware_financiacion: 'Hardware Financiación',
  transferencias_saas: 'Transferencias SaaS',
  otro: 'Pedidos',
}

const VALID_PURCHASE_TYPES = new Set<string>([
  'kit_digital',
  'hardware_one_off',
  'hardware_financiacion',
  'transferencias_saas',
  'otro',
])

export async function POST(request: NextRequest) {
  // 1. Authenticate via user session
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 1.b. Authorize: solo commercial/hardware/admin pueden crear pedidos.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profile?.role as UserRole | undefined
  if (!canCreateOrder(role)) {
    return NextResponse.json(
      { error: 'No tienes permisos para crear pedidos.' },
      { status: 403 }
    )
  }

  // 2. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de petición inválido' }, { status: 400 })
  }

  // 3. Validate required fields
  const customerName = typeof body.customer_name === 'string' ? body.customer_name.trim() : ''
  if (!customerName) {
    return NextResponse.json(
      { error: 'El nombre del cliente es obligatorio.' },
      { status: 400 }
    )
  }

  // Telefono del cliente obligatorio para pedidos manuales (decision 2026-04-24).
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  if (!phone) {
    return NextResponse.json(
      { error: 'El teléfono del cliente es obligatorio.' },
      { status: 400 }
    )
  }

  // Direccion estructurada (4 campos). CP, calle y ciudad obligatorios; provincia opcional.
  const shippingStreet   = typeof body.shipping_street   === 'string' ? body.shipping_street.trim()   : ''
  const shippingCp       = typeof body.shipping_cp       === 'string' ? body.shipping_cp.trim()       : ''
  const shippingCity     = typeof body.shipping_city     === 'string' ? body.shipping_city.trim()     : ''
  const shippingProvince = typeof body.shipping_province === 'string' ? body.shipping_province.trim() : ''

  if (!shippingStreet) {
    return NextResponse.json({ error: 'La dirección (calle) es obligatoria.' }, { status: 400 })
  }
  if (!shippingCp) {
    return NextResponse.json({ error: 'El código postal es obligatorio.' }, { status: 400 })
  }
  if (!/^\d{5}$/.test(shippingCp)) {
    return NextResponse.json(
      { error: 'El código postal debe tener 5 dígitos exactos.' },
      { status: 400 }
    )
  }
  if (!shippingCity) {
    return NextResponse.json({ error: 'La ciudad es obligatoria.' }, { status: 400 })
  }

  // Validate email format if provided
  const contactEmail = typeof body.contact_email === 'string' ? body.contact_email.trim() : ''
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: 'Email de contacto inválido.' }, { status: 400 })
  }

  const requesterEmail = typeof body.requester_email === 'string' ? body.requester_email.trim() : ''
  if (requesterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
    return NextResponse.json({ error: 'Email del solicitante inválido.' }, { status: 400 })
  }

  // Validate URL format if provided
  const bankReceiptUrl = typeof body.bank_receipt_url === 'string' ? body.bank_receipt_url.trim() : ''
  if (bankReceiptUrl) {
    try {
      new URL(bankReceiptUrl)
    } catch {
      return NextResponse.json({ error: 'URL del justificante bancario inválida.' }, { status: 400 })
    }
  }

  // Serializar los 4 campos estructurados a shipping_address (compat Google Sheets y vistas legacy).
  const serializedAddress = [
    shippingStreet,
    `${shippingCp} ${shippingCity}`,
    shippingProvince || null,
  ]
    .filter((part) => part && part.trim().length > 0)
    .join(', ')

  // 4. Determine sheet_tab from purchase_type
  const purchaseType =
    typeof body.purchase_type === 'string' && VALID_PURCHASE_TYPES.has(body.purchase_type)
      ? (body.purchase_type as PurchaseType)
      : null
  const sheetTab = purchaseType ? SHEET_TAB_MAP[purchaseType] ?? 'Pedidos' : 'Pedidos'

  // 5. Validar y resolver items del carrito ANTES de crear el pedido.
  // El servidor recalcula precios desde products (no se confia en el cliente).
  const admin = createAdminClient()

  const rawItems = Array.isArray(body.items) ? body.items : []
  if (rawItems.length === 0) {
    return NextResponse.json(
      { error: 'Debes añadir al menos un producto al pedido.' },
      { status: 400 },
    )
  }

  interface CartItemInput {
    product_id: string
    qty: number
    discount_pct: number
    product_name_override: string | null
    unit_price_override_cents: number | null
  }

  const cartInputs: CartItemInput[] = []
  for (const raw of rawItems) {
    if (typeof raw !== 'object' || raw === null) {
      return NextResponse.json({ error: 'Línea de carrito inválida.' }, { status: 400 })
    }
    const r = raw as Record<string, unknown>
    if (typeof r.product_id !== 'string' || !r.product_id) {
      return NextResponse.json(
        { error: 'Cada línea debe tener product_id.' },
        { status: 400 },
      )
    }
    const qty = typeof r.qty === 'number' ? Math.floor(r.qty) : 0
    if (qty < 1) {
      return NextResponse.json(
        { error: 'La cantidad debe ser un entero mayor o igual a 1.' },
        { status: 400 },
      )
    }
    // Validacion completa (set + categoria) ocurre mas abajo, cuando tenemos
    // el producto resuelto del catalogo. Aqui solo validamos que sea numero.
    const discountPct = typeof r.discount_pct === 'number' ? r.discount_pct : 0
    if (!Number.isFinite(discountPct)) {
      return NextResponse.json(
        { error: 'Descuento invalido.' },
        { status: 400 },
      )
    }
    cartInputs.push({
      product_id: r.product_id,
      qty,
      discount_pct: discountPct,
      product_name_override:
        typeof r.product_name_override === 'string'
          ? r.product_name_override.trim() || null
          : null,
      unit_price_override_cents:
        typeof r.unit_price_override_cents === 'number'
          ? Math.floor(r.unit_price_override_cents)
          : null,
    })
  }

  const productIds = Array.from(new Set(cartInputs.map((it) => it.product_id)))
  const { data: catalogProducts, error: productsError } = await admin
    .from('products')
    .select('*')
    .in('id', productIds)
    .eq('active', true)

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 })
  }

  const productMap = new Map<string, Product>()
  for (const p of (catalogProducts ?? []) as Product[]) {
    productMap.set(p.id, p)
  }

  // Resolver cada línea: snapshot de precio, IVA y nombre.
  interface ResolvedLine {
    product_id: string
    product_name: string
    qty: number
    discount_pct: number
    unit_price_cents: number
    vat_rate: number
  }
  // IGIC 7 % si el CP de envio es de Canarias (35xxx / 38xxx). Snapshot
  // inmutable en order_items.vat_rate. Solo afecta a pedidos nuevos.
  const igicApplies = isCanaryIslands(shippingCp)
  const overrideVatRate: number | null = igicApplies ? 7 : null

  const resolved: ResolvedLine[] = []
  for (const it of cartInputs) {
    const product = productMap.get(it.product_id)
    if (!product) {
      return NextResponse.json(
        { error: 'Producto inactivo o inexistente en el carrito.' },
        { status: 400 },
      )
    }
    // Valida descuento contra el set permitido (0/10/100) y, si es 100,
    // que la categoria sea 'printer' (Promocion Printer).
    const discountCheck = validateLineDiscount(it.discount_pct, product.category)
    if (!discountCheck.ok) {
      return NextResponse.json({ error: discountCheck.error }, { status: 400 })
    }
    let unitPriceCents = product.price_cents
    let productName = product.name
    // Productos con precio libre negociado por el AE/AM:
    //   - code='otro' (cualquier item ad-hoc)
    //   - category='saas_hardware' (ofertas SaaS + Hardware)
    // Exigimos descripcion y precio > 0; mensajes diferenciados.
    const isFreePriceProduct =
      product.code === 'otro' || product.category === 'saas_hardware'
    if (isFreePriceProduct) {
      const isSaasHw = product.category === 'saas_hardware'
      if (!it.product_name_override) {
        return NextResponse.json(
          {
            error: isSaasHw
              ? 'Las lineas SaaS + Hardware requieren descripcion de la oferta.'
              : 'Las líneas "Otro" requieren descripción del producto.',
          },
          { status: 400 },
        )
      }
      if (
        it.unit_price_override_cents === null ||
        it.unit_price_override_cents <= 0
      ) {
        return NextResponse.json(
          {
            error: isSaasHw
              ? 'Las lineas SaaS + Hardware requieren un precio negociado mayor que 0.'
              : 'Las líneas "Otro" requieren un precio unitario mayor que 0.',
          },
          { status: 400 },
        )
      }
      unitPriceCents = it.unit_price_override_cents
      productName = it.product_name_override
    }
    resolved.push({
      product_id: product.id,
      product_name: productName,
      qty: it.qty,
      discount_pct: it.discount_pct,
      unit_price_cents: unitPriceCents,
      // Snapshot: si el envio es a Canarias aplicamos IGIC 7 %; si no, IVA
      // del producto (21 % por defecto). Decision por shipping_cp.
      vat_rate: overrideVatRate ?? Number(product.vat_rate),
    })
  }

  // Total con IVA en céntimos → euros (compat orders.amount).
  const totals = cartTotals(
    resolved.map((l) => ({
      priceCents: l.unit_price_cents,
      qty: l.qty,
      discountPct: l.discount_pct,
      vatRate: l.vat_rate,
    })),
  )
  const computedAmount = totals.totalCents / 100

  const { data: newOrder, error: insertError } = await admin
    .from('orders')
    .insert({
      customer_name: customerName,
      venue_name: typeof body.venue_name === 'string' ? body.venue_name.trim() || null : null,
      contact_email: contactEmail || null,
      phone,
      purchase_type: purchaseType,
      sheet_tab: sheetTab,
      amount: computedAmount,
      bank_receipt_url: bankReceiptUrl || null,
      requester_name: typeof body.requester_name === 'string' ? body.requester_name.trim() || null : null,
      requester_email: requesterEmail || null,
      ae_ref: typeof body.ae_ref === 'string' ? body.ae_ref.trim() || null : null,
      hubspot_ref: typeof body.hubspot_ref === 'string' ? body.hubspot_ref.trim() || null : null,
      // 4 columnas estructuradas (uso primario para TIPSA).
      shipping_street: shippingStreet,
      shipping_cp: shippingCp,
      shipping_city: shippingCity,
      shipping_province: shippingProvince || null,
      // Serializado para compat con Google Sheets y vistas legacy.
      shipping_address: serializedAddress,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      created_by: user.id,
      status: 'nuevo',
      source: 'manual',
    })
    .select('id, operation_id')
    .single()

  if (insertError || !newOrder) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Error al crear el pedido.' },
      { status: 500 }
    )
  }

  // 6. Insert items con snapshot de precio, IVA, descuento y product_id.
  const { error: itemsError } = await admin.from('order_items').insert(
    resolved.map((line) => ({
      order_id: newOrder.id,
      product_id: line.product_id,
      product_name: line.product_name,
      qty: line.qty,
      discount_pct: line.discount_pct,
      unit_price_cents: line.unit_price_cents,
      vat_rate: line.vat_rate,
    })),
  )

  if (itemsError) {
    console.error('Error inserting order items:', itemsError.message)
  }

  // 7. Insert initial status_history entry
  const { error: historyError } = await admin.from('status_history').insert({
    order_id: newOrder.id,
    from_status: null,
    to_status: 'nuevo',
    changed_by: user.id,
    changed_at: new Date().toISOString(),
    comment: 'Pedido creado manualmente',
  })

  if (historyError) {
    console.error('Error inserting status_history:', historyError.message)
  }

  // 7.5 A~adir al address_book si la direccion esta estructurada.
  // No bloquea: silencia errores, dedupe natural via UNIQUE constraint.
  if (shippingStreet && shippingCp && shippingCity) {
    void upsertAddressFromOrder(admin, {
      name: customerName,
      address: shippingStreet,
      cp: shippingCp,
      city: shippingCity,
      venue_name: typeof body.venue_name === 'string' ? body.venue_name.trim() || null : null,
      province: shippingProvince || null,
      phone: phone || null,
      email: contactEmail || null,
      created_by: user.id,
    })
  }

  // 8. Call Edge Function notify-slack (fire and forget)
  try {
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-slack`
    fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        event: 'new_order',
        order_id: newOrder.id,
        operation_id: newOrder.operation_id,
        customer_name: customerName,
        venue_name: typeof body.venue_name === 'string' ? body.venue_name.trim() || null : null,
        requester_name: typeof body.requester_name === 'string' ? body.requester_name.trim() || null : null,
        status: 'nuevo',
      }),
    }).catch((e) => console.error('notify-slack fetch error:', e))
  } catch (slackError) {
    console.error('Error calling notify-slack edge function:', slackError)
  }

  return NextResponse.json({ id: newOrder.id, operation_id: newOrder.operation_id })
}
