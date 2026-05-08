import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/external-auth'
import { applyCors, handlePreflight } from '@/lib/external-cors'
import {
  cartTotals,
  lineTaxableCents,
  lineTotalCents,
  lineVatCents,
} from '@/lib/pricing'
import { PURCHASE_TYPE_LABELS } from '@/lib/utils'
import type { OrderStatus, PurchaseType } from '@/types/database'
import type {
  HwToolboxAe,
  HwToolboxDetailResponse,
  HwToolboxOrderDetail,
  HwToolboxOrderItem,
} from '@/types/external'
import { HWTOOLBOX_VISIBLE_STATUSES } from '../route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: NextRequest) {
  return handlePreflight(request, 'HWTOOLBOX_ORIGIN')
}

interface OrderRow {
  id: string
  operation_id: string
  customer_name: string | null
  venue_name: string | null
  purchase_type: PurchaseType | null
  status: OrderStatus
  created_at: string
  ae_ref: string | null
  created_by: string | null
}

interface ItemRow {
  qty: number | null
  product_name: string | null
  unit_price_cents: number | null
  vat_rate: number | null
  discount_pct: number | null
  product: { code: string | null; name: string | null } | null
}

interface UserRow {
  full_name: string | null
  email: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ operationId: string }> },
) {
  // 1. Auth
  const auth = validateApiKey(request, 'HWTOOLBOX_API_KEY')
  if (!auth.ok) return applyCors(auth.response, request, 'HWTOOLBOX_ORIGIN')

  // 2. Path param
  const { operationId } = await params
  const opId = operationId.trim()
  if (!opId) {
    return applyCors(
      NextResponse.json({ error: 'operationId vacío' }, { status: 400 }),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  const admin = createAdminClient()

  // 3. Cargar pedido con items + producto. Filtrado por operation_id Y status visible
  //    en una sola consulta para no leak de existencia (404 indistinguible).
  const orderRes = await admin
    .from('orders')
    .select(
      'id, operation_id, customer_name, venue_name, purchase_type, status, created_at, ae_ref, created_by',
    )
    .eq('operation_id', opId)
    .in('status', HWTOOLBOX_VISIBLE_STATUSES)
    .maybeSingle()

  if (orderRes.error) {
    console.error('[external/hwtoolbox/orders/detail] order query error:', orderRes.error.message)
    return applyCors(
      NextResponse.json(
        { error: 'Error consultando pedido', detail: orderRes.error.message },
        { status: 502 },
      ),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  if (!orderRes.data) {
    return applyCors(
      NextResponse.json({ error: 'not_found' }, { status: 404 }),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  const order = orderRes.data as OrderRow

  // 4. Cargar order_items con producto join
  const itemsRes = await admin
    .from('order_items')
    .select(
      'qty, product_name, unit_price_cents, vat_rate, discount_pct, product:products(code, name)',
    )
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })

  if (itemsRes.error) {
    console.error('[external/hwtoolbox/orders/detail] items query error:', itemsRes.error.message)
    return applyCors(
      NextResponse.json(
        { error: 'Error consultando items', detail: itemsRes.error.message },
        { status: 502 },
      ),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  const itemsRaw = (itemsRes.data ?? []) as unknown as ItemRow[]

  // 5. Cargar AE (created_by) si existe
  let ae: HwToolboxAe | null = null
  if (order.created_by) {
    const userRes = await admin
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', order.created_by)
      .maybeSingle()
    if (!userRes.error && userRes.data) {
      const u = userRes.data as UserRow
      ae = {
        full_name: u.full_name,
        email: u.email,
        ae_ref: order.ae_ref,
      }
    }
  }
  // Si created_by es null pero hay ae_ref, devolvemos ae con datos parciales.
  if (!ae && order.ae_ref) {
    ae = {
      full_name: null,
      email: null,
      ae_ref: order.ae_ref,
    }
  }

  // 6. Calcular precios por linea reutilizando lib/pricing.ts (misma formula del form)
  const items: HwToolboxOrderItem[] = itemsRaw
    .filter((it) => it.unit_price_cents != null && it.qty != null)
    .map((it) => {
      const qty = Number(it.qty)
      const priceCents = Number(it.unit_price_cents)
      const vatRate = Number(it.vat_rate ?? 21)
      const discountPct = Number(it.discount_pct ?? 0)
      const productName =
        it.product?.name ?? it.product_name ?? '(producto sin nombre)'
      return {
        product_code: it.product?.code ?? null,
        product_name: productName,
        qty,
        unit_price_cents: priceCents,
        vat_rate: vatRate,
        discount_pct: discountPct,
        subtotal_cents: lineTaxableCents(priceCents, qty, discountPct),
        vat_amount_cents: lineVatCents(priceCents, qty, discountPct, vatRate),
        total_cents: lineTotalCents(priceCents, qty, discountPct, vatRate),
        currency: 'EUR',
      }
    })

  // 7. Totales agregados
  const totals = cartTotals(
    items.map((it) => ({
      priceCents: it.unit_price_cents,
      qty: it.qty,
      discountPct: it.discount_pct,
      vatRate: it.vat_rate,
    })),
  )

  const detail: HwToolboxOrderDetail = {
    operation_id: order.operation_id,
    customer_name: order.customer_name ?? '',
    venue_name: order.venue_name,
    purchase_type: order.purchase_type,
    purchase_type_label: order.purchase_type
      ? PURCHASE_TYPE_LABELS[order.purchase_type]
      : null,
    status: order.status,
    created_at: order.created_at,
    ae,
    items,
    totals: {
      subtotal_cents: totals.subtotalCents,
      discount_cents: totals.discountCents,
      taxable_cents: totals.taxableCents,
      vat_amount_cents: totals.vatCents,
      total_cents: totals.totalCents,
      currency: 'EUR',
    },
  }

  const payload: HwToolboxDetailResponse = {
    generated_at: new Date().toISOString(),
    order: detail,
  }

  const response = NextResponse.json(payload)
  response.headers.set('Cache-Control', 'private, max-age=30')
  return applyCors(response, request, 'HWTOOLBOX_ORIGIN')
}
