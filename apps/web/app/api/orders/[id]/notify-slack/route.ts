import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canComment } from '@/lib/auth'
import { notifyOrderEvent, formatItemsSummary } from '@/lib/slack'
import type { PurchaseType, UserRole } from '@/types/database'

const MAX_COMMENT_LENGTH = 500

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Comentario libre opcional desde el textarea del SlackNotifyButton.
  // Tolerante: si no hay body o el JSON es inválido, asumimos sin comentario.
  let comment: string | null = null
  try {
    const body = (await request.json()) as { comment?: unknown } | null
    if (body && typeof body.comment === 'string') {
      const trimmed = body.comment.trim()
      if (trimmed.length > MAX_COMMENT_LENGTH) {
        return NextResponse.json(
          {
            error: `El comentario no puede superar ${MAX_COMMENT_LENGTH} caracteres.`,
          },
          { status: 400 },
        )
      }
      comment = trimmed || null
    }
  } catch {
    // Sin body o body inválido: ignoramos, comment se queda null.
  }

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

  // Load order — ampliado para enriquecer el mensaje de Slack: importe,
  // dirección, hubspot, líneas, creador.
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, operation_id, customer_name, venue_name, requester_name, requester_email, status, purchase_type, amount, shipping_city, shipping_cp, hubspot_ref, order_items(product_name, qty), creator:user_profiles!orders_created_by_fkey(full_name)',
    )
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  // Resolver el Slack ID del solicitante por email (si tiene perfil con
  // slack_user_id relleno en /admin/users). Usamos admin para no depender
  // de la RLS de user_profiles. Si no hay match, solo @aquí.
  let requesterSlackUserId: string | null = null
  if (order.requester_email) {
    const admin = createAdminClient()
    const { data: requesterProfile } = await admin
      .from('user_profiles')
      .select('slack_user_id')
      .eq('email', order.requester_email)
      .maybeSingle()
    requesterSlackUserId = requesterProfile?.slack_user_id ?? null
  }

  // El embed creator:user_profiles!fk(...) puede tiparse como objeto o
  // array según el inference de Supabase; tratamos ambos casos a runtime.
  const creatorRaw = order.creator as
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null
  const creator = Array.isArray(creatorRaw) ? creatorRaw[0] ?? null : creatorRaw

  const items = (order.order_items ?? []) as Array<{
    product_name: string
    qty: number
  }>

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
    amount_cents:
      typeof order.amount === 'number' ? Math.round(order.amount * 100) : null,
    requester_slack_user_id: requesterSlackUserId,
    items_summary: formatItemsSummary(items),
    shipping_city: order.shipping_city ?? null,
    shipping_cp: order.shipping_cp ?? null,
    hubspot_ref: order.hubspot_ref ?? null,
    creator_name: creator?.full_name ?? null,
    comment,
  })
  if (!slackResult.ok) {
    return NextResponse.json(
      { error: 'Error al enviar a Slack', detail: slackResult.error },
      { status: 502 },
    )
  }
  // El botón manual es una acción explícita: si el webhook no está
  // configurado, no podemos fingir éxito al usuario. (Los call-sites
  // automáticos sí toleran 'skipped' para no romper la operación.)
  if (slackResult.skipped) {
    return NextResponse.json(
      {
        error:
          'Slack no está configurado en este entorno (falta SLACK_WEBHOOK_URL).',
      },
      { status: 503 },
    )
  }

  return NextResponse.json({ ok: true })
}
