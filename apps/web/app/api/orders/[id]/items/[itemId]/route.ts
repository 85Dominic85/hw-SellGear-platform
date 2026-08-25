// =============================================================
// PATCH /api/orders/[id]/items/[itemId]
// Edita el descuento por línea (discount_pct) de un order_item.
// Recalcula orders.amount con el nuevo desglose (todas las líneas +
// discount_global_pct del pedido).
//
// Permisos: canEditOrder (admin/manager/hardware).
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canEditOrder } from '@/lib/auth'
import { validateLineDiscount } from '@/lib/orders-validation'
import type { ProductLike } from '@/lib/product-rules'
import { cartTotals } from '@/lib/pricing'
import type { UserRole, PurchaseType } from '@/types/database'

export const runtime = 'nodejs'

interface RequestBody {
  discount_pct?: unknown
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id: orderId, itemId } = await params

  // 1. Auth + permisos.
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
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profile?.role as UserRole | undefined
  if (!canEditOrder(role)) {
    return NextResponse.json(
      { error: 'No tienes permisos para editar pedidos.' },
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
  if (body.discount_pct === undefined) {
    return NextResponse.json(
      { error: 'discount_pct es obligatorio.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // 3. Cargar el item con su producto (para validar el descuento contra sus
  //    reglas) y confirmar que pertenece al pedido.
  //    Requiere la migración 20260825000001 aplicada (allows_discount).
  const { data: item, error: itemError } = await admin
    .from('order_items')
    .select(
      'id, order_id, product_id, products:products(category, code, allows_discount)',
    )
    .eq('id', itemId)
    .eq('order_id', orderId)
    .single()
  if (itemError || !item) {
    return NextResponse.json({ error: 'Línea no encontrada.' }, { status: 404 })
  }

  // El embed products puede tiparse como objeto o array segun el inference
  // de Supabase; tratamos ambos casos.
  const productRaw = item.products as ProductLike | ProductLike[] | null
  const product = Array.isArray(productRaw) ? productRaw[0] ?? null : productRaw

  // 4. Bloquear el descuento en pedidos de financiación (mantiene la
  //    invariante del POST /api/orders).
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('purchase_type, discount_global_pct, manual_adjustment_cents')
    .eq('id', orderId)
    .single()
  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 })
  }
  const purchaseType = order.purchase_type as PurchaseType | null
  if (
    purchaseType === 'hardware_financiacion' &&
    typeof body.discount_pct === 'number' &&
    body.discount_pct !== 0
  ) {
    return NextResponse.json(
      { error: 'Los pedidos de financiación no admiten descuento.' },
      { status: 400 },
    )
  }

  // 5. Validar el nuevo descuento contra las reglas del producto.
  const check = validateLineDiscount(body.discount_pct, product)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 })
  }

  // 6. Actualizar el item.
  const { error: updateError } = await admin
    .from('order_items')
    .update({ discount_pct: check.pct })
    .eq('id', itemId)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // 7. Recalcular orders.amount con TODAS las líneas + descuento global.
  const { data: allItems, error: itemsError } = await admin
    .from('order_items')
    .select('qty, unit_price_cents, discount_pct, vat_rate')
    .eq('order_id', orderId)
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }
  const globalPct = order.discount_global_pct ?? 0
  const manualAdjustment = order.manual_adjustment_cents ?? 0
  const modern = (allItems ?? []).filter(
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
      Number(globalPct),
      Number(manualAdjustment),
    )
    const newAmount = totals.totalCents / 100
    await admin
      .from('orders')
      .update({ amount: newAmount, updated_at: new Date().toISOString() })
      .eq('id', orderId)
  }

  return NextResponse.json({ ok: true, discount_pct: check.pct })
}
