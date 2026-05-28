import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canComment } from '@/lib/auth'
import { notifyOrderEvent } from '@/lib/slack'
import type { PurchaseType, UserRole } from '@/types/database'

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

  // Load order (con purchase_type para mención por categoría).
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, operation_id, customer_name, venue_name, requester_name, status, purchase_type',
    )
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  // Reenvío manual: lanza un new_order al canal (lib/slack.ts).
  // A diferencia del envío automático, aquí 502 si falla (el usuario
  // pulsó "Enviar a Slack" expresamente y debe saber si no llegó).
  const slackResult = await notifyOrderEvent({
    event: 'new_order',
    order_id: order.id,
    operation_id: order.operation_id,
    customer_name: order.customer_name,
    venue_name: order.venue_name,
    requester_name: order.requester_name,
    purchase_type: order.purchase_type as PurchaseType | null,
  })
  if (!slackResult.ok) {
    return NextResponse.json(
      { error: 'Error al enviar a Slack', detail: slackResult.error },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, skipped: slackResult.skipped })
}
