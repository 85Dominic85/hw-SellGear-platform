import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    .select('id, operation_id, customer_name, venue_name, status')
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

  // Notificación Slack fire-and-forget
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-slack`
    void fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        event: 'message_to_hardware',
        order_id: order.id,
        operation_id: order.operation_id,
        customer_name: order.customer_name,
        venue_name: order.venue_name,
        author_name: profile.full_name ?? profile.email ?? 'Usuario',
        author_role: profile.role,
        message,
      }),
    }).catch((e) => console.error('[message-to-hardware] slack error:', e))
  } catch (e) {
    console.error('[message-to-hardware] slack build error:', e)
  }

  return NextResponse.json({ ok: true })
}
