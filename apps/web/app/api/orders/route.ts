import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PurchaseType } from '@/types/database'

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
  const contactPerson    = typeof body.contact_person    === 'string' ? body.contact_person.trim()    : ''

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

  // 5. Insert order with admin client (bypasses RLS)
  const admin = createAdminClient()

  const { data: newOrder, error: insertError } = await admin
    .from('orders')
    .insert({
      customer_name: customerName,
      venue_name: typeof body.venue_name === 'string' ? body.venue_name.trim() || null : null,
      contact_email: contactEmail || null,
      phone,
      purchase_type: purchaseType,
      sheet_tab: sheetTab,
      amount: typeof body.amount === 'number' ? body.amount : null,
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
      contact_person: contactPerson || null,
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

  // 6. Insert items (filter out blank rows)
  const items = Array.isArray(body.items) ? body.items : []
  const validItems = items.filter(
    (item: unknown): item is { product_name: string; qty: number } =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).product_name === 'string' &&
      (item as Record<string, unknown>).product_name !== '' &&
      typeof (item as Record<string, unknown>).qty === 'number'
  )

  if (validItems.length > 0) {
    const { error: itemsError } = await admin.from('order_items').insert(
      validItems.map((item) => ({
        order_id: newOrder.id,
        product_name: item.product_name.trim(),
        qty: item.qty,
      }))
    )

    if (itemsError) {
      console.error('Error inserting order items:', itemsError.message)
    }
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
