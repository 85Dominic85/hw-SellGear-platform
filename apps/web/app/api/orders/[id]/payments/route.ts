import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth'
import type { PurchaseType, UserRole } from '@/types/database'
import { isCanaryIslands } from '@/lib/utils'
import { financingInstallments, isFinanceableCode } from '@/lib/financing'
import { notifyOrderEvent } from '@/lib/slack'

// Gestión de los plazos de pago de un pedido de financiación.
// PATCH: marcar/actualizar un plazo (estado, fecha, justificante).
// POST : generar el plan de 3 plazos para pedidos antiguos sin filas.
// Solo admin / manager / hardware. El comercial/viewer no escribe.

const EDITOR_ROLES: UserRole[] = ['admin', 'manager', 'hardware']

async function verifyEditor() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', status: 401 as const }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as UserRole | undefined
  const isEditor =
    isAdminUser(profile?.email ?? user.email, role) ||
    (role && EDITOR_ROLES.includes(role))

  if (!isEditor) return { error: 'Sin permisos de edición', status: 403 as const }
  return { user }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  const auth = await verifyEditor()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de petición inválido' }, { status: 400 })
  }

  const installmentNo =
    typeof body.installment_no === 'number' ? Math.floor(body.installment_no) : NaN
  if (![1, 2, 3].includes(installmentNo)) {
    return NextResponse.json(
      { error: 'installment_no debe ser 1, 2 o 3.' },
      { status: 400 },
    )
  }

  const update: Record<string, unknown> = {}

  if ('status' in body) {
    if (body.status !== 'pendiente' && body.status !== 'pagado') {
      return NextResponse.json(
        { error: "status debe ser 'pendiente' o 'pagado'." },
        { status: 400 },
      )
    }
    update.status = body.status
    // Al marcar pagado sin fecha explícita, sellar ahora. Al volver a
    // pendiente, limpiar la fecha.
    if (body.status === 'pagado' && !('paid_at' in body)) {
      update.paid_at = new Date().toISOString()
    }
    if (body.status === 'pendiente') {
      update.paid_at = null
    }
  }

  if ('paid_at' in body) {
    if (body.paid_at === null || body.paid_at === '') {
      update.paid_at = null
    } else if (typeof body.paid_at === 'string') {
      const d = new Date(body.paid_at)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Fecha de pago inválida.' }, { status: 400 })
      }
      update.paid_at = d.toISOString()
    }
  }

  if ('receipt_url' in body) {
    if (body.receipt_url === null || body.receipt_url === '') {
      update.receipt_url = null
    } else if (typeof body.receipt_url === 'string') {
      try {
        new URL(body.receipt_url)
      } catch {
        return NextResponse.json(
          { error: 'URL del justificante inválida.' },
          { status: 400 },
        )
      }
      update.receipt_url = body.receipt_url.trim()
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('order_payments')
    .update(update)
    .eq('order_id', orderId)
    .eq('installment_no', installmentNo)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aviso a Slack solo cuando se marca un plazo como pagado. Carga datos
  // del pedido para la mención por categoría. Nunca lanza.
  if (data && data.status === 'pagado' && update.status === 'pagado') {
    const { data: order } = await admin
      .from('orders')
      .select('operation_id, customer_name, venue_name, purchase_type')
      .eq('id', orderId)
      .single()
    if (order) {
      const slackResult = await notifyOrderEvent({
        event: 'financing_payment',
        order_id: orderId,
        operation_id: order.operation_id,
        customer_name: order.customer_name,
        venue_name: order.venue_name,
        purchase_type: order.purchase_type as PurchaseType | null,
        installment_no: data.installment_no as 1 | 2 | 3,
        amount_cents: data.amount_cents,
      })
      if (!slackResult.ok) {
        console.error('Slack notify error (financing_payment):', slackResult.error)
      }
    }
  }

  return NextResponse.json({ payment: data })
}

// POST: generar el plan de pagos para un pedido de financiación que aún no
// lo tiene (pedidos creados antes de esta feature). Idempotente: si ya hay
// filas, las devuelve sin duplicar.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  const auth = await verifyEditor()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const admin = createAdminClient()

  // ¿Ya hay plazos?
  const { data: existing } = await admin
    .from('order_payments')
    .select('*')
    .eq('order_id', orderId)
    .order('installment_no')
  if (existing && existing.length > 0) {
    return NextResponse.json({ payments: existing })
  }

  // Cargar el pedido + su línea financiable.
  const { data: order } = await admin
    .from('orders')
    .select('id, purchase_type, shipping_cp, order_items(product_id, products(code))')
    .eq('id', orderId)
    .single()

  if (!order || order.purchase_type !== 'hardware_financiacion') {
    return NextResponse.json(
      { error: 'El pedido no es de financiación.' },
      { status: 400 },
    )
  }

  const items = (order.order_items ?? []) as Array<{
    products?: { code?: string } | null
  }>
  const code = items.find((i) => i.products?.code && isFinanceableCode(i.products.code))
    ?.products?.code
  if (!code) {
    return NextResponse.json(
      { error: 'El pedido no contiene un producto financiable.' },
      { status: 400 },
    )
  }

  const vatRate = isCanaryIslands(order.shipping_cp) ? 0 : 21
  const installments = financingInstallments(code, vatRate)
  if (!installments) {
    return NextResponse.json({ error: 'Producto no financiable.' }, { status: 400 })
  }

  const { data: inserted, error } = await admin
    .from('order_payments')
    .insert(
      installments.map((inst) => ({
        order_id: orderId,
        installment_no: inst.stage,
        amount_base_cents: inst.baseCents,
        vat_rate: vatRate,
        amount_cents: inst.grossCents,
        status: 'pendiente',
      })),
    )
    .select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ payments: inserted })
}
