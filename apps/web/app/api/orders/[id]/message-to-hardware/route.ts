import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyOrderEvent } from '@/lib/slack'
import type { PurchaseType } from '@/types/database'

export const runtime = 'nodejs'

interface MessageBody {
  message?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()
  if (!profile?.role) {
    return NextResponse.json({ error: 'Sin perfil' }, { status: 403 })
  }

  let body: MessageBody
  try {
    body = (await request.json()) as MessageBody
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const message = (body.message ?? '').trim()
  if (!message) {
    return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Mensaje demasiado largo (máx 2000)' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, operation_id, customer_name, venue_name, status, purchase_type, amount')
    .eq('id', id)
    .single()
  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const formattedBody = `[Mensaje para Hardware] ${message}`

  const { error: insertError } = await admin.from('comments').insert({
    order_id: order.id,
    author_id: user.id,
    body: formattedBody,
  })
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Aviso a Slack (lib/slack.ts → webhook directo; nunca lanza). Antes el
  // evento message_to_hardware se enviaba a la edge function que lo
  // descartaba; ahora sí llega al canal con @here + categoría.
  const slackResult = await notifyOrderEvent({
    event: 'message_to_hardware',
    order_id: order.id,
    operation_id: order.operation_id,
    customer_name: order.customer_name,
    venue_name: order.venue_name,
    purchase_type: order.purchase_type as PurchaseType | null,
    amount_cents:
      typeof order.amount === 'number' ? Math.round(order.amount * 100) : null,
    author_name: profile.full_name ?? profile.email ?? 'Usuario',
    author_role: profile.role,
    message,
  })
  if (!slackResult.ok) {
    console.error('[slack] message_to_hardware falló:', slackResult.error)
  } else if (slackResult.skipped) {
    console.warn('[slack] message_to_hardware omitido (webhook no configurado).')
  }

  return NextResponse.json({ ok: true })
}
