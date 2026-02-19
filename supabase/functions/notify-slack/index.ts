// =============================================================
// Edge Function: notify-slack
// Envía mensajes al canal privado de Hardware en Slack.
// Eventos: new_order, status_change, falta_info
// =============================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface SlackPayload {
  event: 'new_order' | 'status_change' | 'falta_info'
  order_id: string
  operation_id: string
  customer_name: string
  status: string
  from_status?: string
  changed_by?: string
  comment?: string
}

const STATUS_LABELS: Record<string, string> = {
  nuevo:               '🆕 Nuevo',
  en_revision:         '🔍 En revisión',
  falta_info:          '⚠️ Falta info',
  aprobado:            '✅ Aprobado',
  pedido_a_proveedor:  '📦 Pedido a proveedor',
  en_transito:         '🚚 En tránsito',
  recibido:            '📬 Recibido',
  preparacion:         '🔧 Preparación/Envío',
  completado:          '🎉 Completado',
  cancelado:           '❌ Cancelado',
}

function buildMessage(payload: SlackPayload, appUrl: string): object {
  const orderUrl = `${appUrl}/orders/${payload.order_id}`
  const statusLabel = STATUS_LABELS[payload.status] ?? payload.status

  if (payload.event === 'new_order') {
    return {
      text: `*Nuevo pedido recibido:* ${payload.operation_id}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📥 Nuevo pedido', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*ID:*\n<${orderUrl}|${payload.operation_id}>` },
            { type: 'mrkdwn', text: `*Cliente:*\n${payload.customer_name}` },
            { type: 'mrkdwn', text: `*Estado:*\n${statusLabel}` },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Ver pedido', emoji: true },
              url: orderUrl,
              style: 'primary',
            },
          ],
        },
      ],
    }
  }

  if (payload.event === 'falta_info') {
    return {
      text: `⚠️ Pedido ${payload.operation_id} necesita más información`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *Falta información* en el pedido <${orderUrl}|${payload.operation_id}> (${payload.customer_name})${payload.comment ? `\n> ${payload.comment}` : ''}`,
          },
        },
      ],
    }
  }

  // status_change
  const fromLabel = payload.from_status ? (STATUS_LABELS[payload.from_status] ?? payload.from_status) : '—'
  return {
    text: `Pedido ${payload.operation_id} → ${statusLabel}`,
    blocks: [
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Pedido:*\n<${orderUrl}|${payload.operation_id}>` },
          { type: 'mrkdwn', text: `*Cliente:*\n${payload.customer_name}` },
          { type: 'mrkdwn', text: `*Antes:*\n${fromLabel}` },
          { type: 'mrkdwn', text: `*Ahora:*\n${statusLabel}` },
          ...(payload.changed_by
            ? [{ type: 'mrkdwn', text: `*Por:*\n${payload.changed_by}` }]
            : []),
          ...(payload.comment
            ? [{ type: 'mrkdwn', text: `*Comentario:*\n${payload.comment}` }]
            : []),
        ],
      },
    ],
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
  if (!webhookUrl) {
    console.warn('SLACK_WEBHOOK_URL not configured — skipping notification')
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://your-app.vercel.app'

  let payload: SlackPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Filtrar eventos irrelevantes (evitar spam)
  const relevantEvents = ['new_order', 'status_change', 'falta_info']
  if (!relevantEvents.includes(payload.event)) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // No notificar cambios triviales (ej: de nuevo a nuevo)
  if (
    payload.event === 'status_change' &&
    payload.from_status === payload.status
  ) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const message = buildMessage(payload, appUrl)

  const slackResp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  if (!slackResp.ok) {
    const err = await slackResp.text()
    console.error('Slack error:', err)
    return new Response(
      JSON.stringify({ error: 'Slack notification failed', detail: err }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
})
