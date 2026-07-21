// =============================================================
// PATCH /api/orders/[id]/manual-adjustment
//
// Aplica un ajuste manual (en céntimos) que se RESTA al total c/IVA
// del pedido. Solo admin. El ajuste NO recalcula IVA (decisión de
// negocio: es un "descuento comercial" post-cálculo).
//
// Body: { cents: number, reason: string | null }
//   - cents: entero >= 0 (0 para eliminar el ajuste).
//   - reason: string obligatorio si cents > 0.
//
// Efectos:
//   1. UPDATE orders SET manual_adjustment_cents, manual_adjustment_reason.
//   2. Recalcula orders.amount = totales_desde_lineas - cents (en €).
//      Si el pedido no tiene desglose moderno, mantiene amount tal cual
//      pero le resta el ajuste (fallback razonable para pedidos legacy).
//   3. Inserta comment de auditoría con quién, cuánto y motivo.
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth'
import { cartTotals, formatEurosCents } from '@/lib/pricing'
import type { UserRole } from '@/types/database'

export const runtime = 'nodejs'

interface RequestBody {
  cents?: unknown
  reason?: unknown
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params

  // 1. Auth + solo admin.
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, role')
    .eq('id', user.id)
    .single()
  const role = profile?.role as UserRole | undefined
  if (!isAdminUser(profile?.email ?? user.email, role)) {
    return NextResponse.json(
      { error: 'Solo un administrador puede aplicar ajustes manuales.' },
      { status: 403 },
    )
  }

  // 2. Parse body.
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  // 3. Validar cents (entero >= 0).
  const rawCents = body.cents
  if (rawCents === undefined || rawCents === null) {
    return NextResponse.json(
      { error: 'cents es obligatorio (0 para eliminar el ajuste).' },
      { status: 400 },
    )
  }
  const cents = Number(rawCents)
  if (!Number.isFinite(cents) || !Number.isInteger(cents) || cents < 0) {
    return NextResponse.json(
      { error: 'cents debe ser un entero >= 0.' },
      { status: 400 },
    )
  }

  // 4. Validar motivo (obligatorio si cents > 0).
  const rawReason = body.reason
  let reason: string | null = null
  if (cents > 0) {
    if (typeof rawReason !== 'string' || !rawReason.trim()) {
      return NextResponse.json(
        { error: 'reason es obligatorio cuando cents > 0.' },
        { status: 400 },
      )
    }
    reason = rawReason.trim().slice(0, 500)
  }

  // 5. Cargar pedido + líneas para recalcular amount.
  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select(
      'id, amount, discount_global_pct, manual_adjustment_cents, manual_adjustment_reason',
    )
    .eq('id', orderId)
    .single()
  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 })
  }

  const { data: items, error: itemsError } = await admin
    .from('order_items')
    .select('qty, unit_price_cents, discount_pct, vat_rate')
    .eq('order_id', orderId)
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const modern = (items ?? []).filter(
    (i) => i.unit_price_cents !== null && i.unit_price_cents !== undefined,
  )

  // 6. Calcular nuevo amount.
  //    - Modern items: totales_desde_lineas (con globalPct) - cents.
  //    - Legacy: amount_actual_antes_del_ajuste_anterior - cents.
  //      Recomponemos "amount limpio" sumando el ajuste previo al amount actual.
  const prevCents = order.manual_adjustment_cents ?? 0
  let newAmountEuros: number | null = null

  if (modern.length > 0) {
    const totals = cartTotals(
      modern.map((i) => ({
        priceCents: i.unit_price_cents as number,
        qty: i.qty,
        discountPct: Number(i.discount_pct ?? 0),
        vatRate: Number(i.vat_rate ?? 21),
      })),
      Number(order.discount_global_pct ?? 0),
    )
    const finalCents = Math.max(0, totals.totalCents - cents)
    newAmountEuros = finalCents / 100
  } else if (order.amount !== null && order.amount !== undefined) {
    // Legacy: reconstruir el amount "sin ajuste previo" y aplicar el nuevo.
    const cleanEuros = Number(order.amount) + prevCents / 100
    newAmountEuros = Math.max(0, cleanEuros - cents / 100)
  }

  // 7. Update en una sola operación.
  const updates: Record<string, unknown> = {
    manual_adjustment_cents: cents,
    manual_adjustment_reason: cents > 0 ? reason : null,
    updated_at: new Date().toISOString(),
  }
  if (newAmountEuros !== null) {
    updates.amount = newAmountEuros
  }
  const { error: updateError } = await admin
    .from('orders')
    .update(updates)
    .eq('id', orderId)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // 8. Auditoría: insertar comment con el cambio.
  //    Formato reconocible ("[ajuste manual]") para distinguirlo de comments normales.
  const auditParts: string[] = ['[ajuste manual]']
  if (cents === 0) {
    auditParts.push('Retirado ajuste manual.')
  } else {
    auditParts.push(`Aplicado ajuste manual: −${formatEurosCents(cents)}.`)
  }
  if (prevCents !== cents && prevCents > 0) {
    auditParts.push(`(previo: −${formatEurosCents(prevCents)})`)
  }
  if (reason) {
    auditParts.push(`Motivo: ${reason}`)
  }
  await admin.from('comments').insert({
    order_id: orderId,
    author_id: user.id,
    body: auditParts.join(' '),
  })

  return NextResponse.json({
    ok: true,
    manual_adjustment_cents: cents,
    manual_adjustment_reason: cents > 0 ? reason : null,
    amount: newAmountEuros,
  })
}
