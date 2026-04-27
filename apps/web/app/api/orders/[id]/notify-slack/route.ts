import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canComment } from '@/lib/auth'
import type { UserRole } from '@/types/database'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()

  // Authenticate
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
  if (!canComment(role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Load order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, operation_id, customer_name, venue_name, requester_name, status')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  // Call Edge Function notify-slack (reuse same format)
  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-slack`

  const resp = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      event: 'new_order',
      order_id: order.id,
      operation_id: order.operation_id,
      customer_name: order.customer_name,
      venue_name: order.venue_name,
      requester_name: order.requester_name,
      status: order.status,
    }),
  })

  if (!resp.ok) {
    const detail = await resp.text()
    return NextResponse.json({ error: 'Error al enviar a Slack', detail }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
