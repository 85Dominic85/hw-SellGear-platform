import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STATUS_TRANSITIONS } from '@/lib/utils'
import type { OrderStatus } from '@/types/database'

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

  // 3. Load the current order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, created_by')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const currentStatus = order.status as OrderStatus

  // 4. Load user profile for role check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
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
  // Creators can only change status when order is 'nuevo' or 'falta_informacion'
  if (role === 'creator') {
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

  // 9. Call Edge Function notify-slack (fire and forget)
  try {
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-slack`
    await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        order_id: id,
        from_status: currentStatus,
        to_status: newStatus,
        changed_by: user.id,
        comment,
      }),
    })
  } catch (slackError) {
    // Non-fatal — Slack notification failure should not block the response
    console.error('Error calling notify-slack edge function:', slackError)
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
