import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STATUS_TRANSITIONS } from '@/lib/utils'
import { notifyOrderEvent } from '@/lib/slack'
import type { OrderStatus, PurchaseType } from '@/types/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // 2. Parse body
  let body: { status?: string; comment?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de petición inválido' }, { status: 400 })
  }

  const newStatus = body.status as OrderStatus | undefined
  const comment = body.comment ?? null

  if (!newStatus) {
    return NextResponse.json({ error: 'El campo status es requerido' }, { status: 400 })
  }

  // 3. Load the current order (incluye creator.slack_user_id para mencionar
  //    en falta_informacion, y purchase_type para menciones por categoría).
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, status, created_by, operation_id, customer_name, venue_name, requester_name, purchase_type, amount, creator:user_profiles!orders_created_by_fkey(slack_user_id)',
    )
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const currentStatus = order.status as OrderStatus

  // 4. Load user profile for role check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'viewer'

  // 4b. Viewers cannot change status at all
  if (role === 'viewer') {
    return NextResponse.json(
      { error: 'Los usuarios viewer no pueden modificar pedidos.' },
      { status: 403 }
    )
  }

  // 5. Validate transition is allowed
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] ?? []

  if (!allowedTransitions.includes(newStatus)) {
    return NextResponse.json(
      {
        error: `Transición no permitida: ${currentStatus} → ${newStatus}`,
      },
      { status: 422 }
    )
  }

  // 6. Role-based restriction:
  // Comerciales solo pueden cambiar el estado cuando el pedido está en 'nuevo' o 'falta_informacion'
  if (role === 'commercial') {
    if (currentStatus !== 'nuevo' && currentStatus !== 'falta_informacion') {
      return NextResponse.json(
        {
          error: 'Solo el equipo de hardware puede cambiar el estado en este punto.',
        },
        { status: 403 }
      )
    }
  }

  // 7. Update order status
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // 8. Insert into status_history
  const { error: historyError } = await supabase.from('status_history').insert({
    order_id: id,
    from_status: currentStatus,
    to_status: newStatus,
    changed_by: user.id,
    changed_at: new Date().toISOString(),
    comment,
  })

  if (historyError) {
    // Non-fatal — log but don't fail the request
    console.error('Error inserting status_history:', historyError.message)
  }

  // 9. Aviso a Slack (lib/slack.ts → webhook directo; nunca lanza; filtra
  //    estados no clave en SLACK_NOTIFY_STATUSES).
  // El embed de Supabase (creator:user_profiles!fk(...)) puede tiparse como
  // array o como objeto según el inference; tratamos ambos casos a runtime.
  const creatorRaw = order.creator as
    | { slack_user_id: string | null }
    | Array<{ slack_user_id: string | null }>
    | null
  const creator = Array.isArray(creatorRaw) ? creatorRaw[0] ?? null : creatorRaw
  const slackResult = await notifyOrderEvent({
    event: 'status_change',
    order_id: id,
    operation_id: order.operation_id,
    customer_name: order.customer_name,
    venue_name: order.venue_name,
    requester_name: order.requester_name,
    purchase_type: order.purchase_type as PurchaseType | null,
    amount_cents:
      typeof order.amount === 'number' ? Math.round(order.amount * 100) : null,
    from_status: currentStatus,
    to_status: newStatus,
    changed_by: profile?.full_name ?? null,
    comment,
    creator_slack_user_id: creator?.slack_user_id ?? null,
  })
  if (!slackResult.ok) {
    console.error('[slack] status_change falló:', slackResult.error)
  } else if (slackResult.skipped) {
    console.warn('[slack] status_change omitido (webhook no configurado).')
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
