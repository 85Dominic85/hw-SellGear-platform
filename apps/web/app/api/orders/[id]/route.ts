import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth'
import type { UserRole, PurchaseType } from '@/types/database'
import { isValidPurchaseType } from '@/lib/purchase-type'
import { validateGlobalDiscount } from '@/lib/orders-validation'
import { cartTotals } from '@/lib/pricing'

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado', status: 401 }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, role')
    .eq('id', user.id)
    .single()

  if (!isAdminUser(profile?.email ?? user.email, profile?.role)) {
    return { error: 'Sin permisos de administrador', status: 403 }
  }

  return { supabase, user }
}

const EDITOR_ROLES: UserRole[] = ['admin', 'manager', 'hardware']

async function verifyEditor() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado', status: 401 }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as UserRole | undefined
  const isEditor =
    isAdminUser(profile?.email ?? user.email, role) ||
    (role && EDITOR_ROLES.includes(role))

  if (!isEditor) {
    return { error: 'Sin permisos de edicion', status: 403 }
  }

  return { supabase, user, role }
}

const EDITABLE_FIELDS = new Set([
  'customer_name',
  'venue_name',
  'purchase_type',
  'amount',
  'discount_global_pct',
  'contact_email',
  'phone',
  'source_department',
  'requester_name',
  'requester_email',
  'bank_receipt_url',
  'ae_ref',
  'hubspot_ref',
  'invoice_ref',
  'shipping_address',
  'shipping_street',
  'shipping_cp',
  'shipping_city',
  'shipping_province',
  'notes',
  'tracking_number',
  'shipping_label_url',
])

// Cuando cambian estos, regeneramos shipping_address serializado para compat con
// Google Sheets y vistas legacy.
const SHIPPING_STRUCTURED_FIELDS = new Set([
  'shipping_street',
  'shipping_cp',
  'shipping_city',
  'shipping_province',
])

// VALID_PURCHASE_TYPES y la validacion exhaustiva viven en lib/purchase-type.ts
// (importado al inicio). Antes este Set se quedo desactualizado cuando se
// anadio saas_hardware al union (commit dea6301) y rompia el PATCH del
// detalle con un 400 "purchase_type invalido" => badge "Error" rojo en UI.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyEditor()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalido' }, { status: 400 })
  }

  // Expect exactly one field
  const entries = Object.entries(body)
  if (entries.length !== 1) {
    return NextResponse.json({ error: 'Enviar exactamente un campo' }, { status: 400 })
  }

  const [field, rawValue] = entries[0]

  if (!EDITABLE_FIELDS.has(field)) {
    return NextResponse.json({ error: `Campo '${field}' no editable` }, { status: 400 })
  }

  // Validate value by field
  let value: string | number | null = rawValue as string | number | null

  if (field === 'customer_name') {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return NextResponse.json({ error: 'customer_name no puede estar vacio' }, { status: 400 })
    }
    value = (value as string).trim()
  } else if (field === 'purchase_type') {
    if (value !== null && !isValidPurchaseType(value)) {
      return NextResponse.json({ error: 'purchase_type invalido' }, { status: 400 })
    }
  } else if (field === 'amount') {
    if (value !== null) {
      const num = Number(value)
      if (isNaN(num)) {
        return NextResponse.json({ error: 'amount debe ser un numero' }, { status: 400 })
      }
      value = num
    }
  } else if (field === 'discount_global_pct') {
    // Rango entero 0-100. Financiación no admite descuento global.
    const check = validateGlobalDiscount(value)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }
    const { data: cur } = await createAdminClient()
      .from('orders')
      .select('purchase_type')
      .eq('id', id)
      .single()
    if (
      (cur?.purchase_type as PurchaseType | null) === 'hardware_financiacion' &&
      check.pct !== 0
    ) {
      return NextResponse.json(
        { error: 'Los pedidos de financiación no admiten descuento global.' },
        { status: 400 },
      )
    }
    value = check.pct
  } else if (field === 'contact_email' || field === 'requester_email') {
    if (value !== null && typeof value === 'string' && value.trim()) {
      // Basic email validation
      if (!value.includes('@')) {
        return NextResponse.json({ error: `${field} debe ser un email valido` }, { status: 400 })
      }
      value = value.trim()
    } else {
      value = null
    }
  } else if (field === 'bank_receipt_url' || field === 'shipping_label_url' || field === 'invoice_ref') {
    if (value !== null && typeof value === 'string' && value.trim()) {
      try {
        new URL(value)
      } catch {
        return NextResponse.json({ error: `${field} debe ser una URL valida` }, { status: 400 })
      }
      value = value.trim()
    } else {
      value = null
    }
  } else if (field === 'shipping_cp') {
    if (value !== null && typeof value === 'string' && value.trim()) {
      const cp = value.trim()
      if (!/^\d{5}$/.test(cp)) {
        return NextResponse.json({ error: 'shipping_cp debe tener 5 dígitos exactos' }, { status: 400 })
      }
      value = cp
    } else {
      value = null
    }
  } else {
    // String fields: trim or null
    if (typeof value === 'string') {
      value = value.trim() || null
    }
  }

  const adminClient = createAdminClient()
  const updates: Record<string, unknown> = { [field]: value }

  // Si cambia uno de los 4 campos estructurados de direccion, regenerar
  // el textarea serializado shipping_address para que Google Sheets y vistas
  // legacy sigan mostrando la direccion completa.
  if (SHIPPING_STRUCTURED_FIELDS.has(field)) {
    const { data: current } = await adminClient
      .from('orders')
      .select('shipping_street, shipping_cp, shipping_city, shipping_province')
      .eq('id', id)
      .single()

    if (current) {
      const next = {
        shipping_street: current.shipping_street,
        shipping_cp: current.shipping_cp,
        shipping_city: current.shipping_city,
        shipping_province: current.shipping_province,
        [field]: value,
      }
      const parts: string[] = []
      if (next.shipping_street) parts.push(next.shipping_street as string)
      if (next.shipping_cp && next.shipping_city) {
        parts.push(`${next.shipping_cp} ${next.shipping_city}`)
      } else if (next.shipping_city) {
        parts.push(next.shipping_city as string)
      }
      if (next.shipping_province) parts.push(next.shipping_province as string)
      updates.shipping_address = parts.length > 0 ? parts.join(', ') : null
    }
  }

  const { error } = await adminClient
    .from('orders')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Si cambia el descuento global, recalcular orders.amount con TODAS
  // las líneas del pedido para mantener la coherencia.
  if (field === 'discount_global_pct') {
    const { data: items } = await adminClient
      .from('order_items')
      .select('qty, unit_price_cents, discount_pct, vat_rate')
      .eq('order_id', id)
    const modern = (items ?? []).filter(
      (i) => i.unit_price_cents !== null && i.unit_price_cents !== undefined,
    )
    if (modern.length > 0) {
      const totals = cartTotals(
        modern.map((i) => ({
          priceCents: i.unit_price_cents as number,
          qty: i.qty,
          discountPct: Number(i.discount_pct ?? 0),
          vatRate: Number(i.vat_rate ?? 21),
        })),
        Number(value ?? 0),
      )
      await adminClient
        .from('orders')
        .update({ amount: totals.totalCents / 100, updated_at: new Date().toISOString() })
        .eq('id', id)
    }
  }

  return NextResponse.json({ ok: true, field, value })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const { supabase } = auth

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
