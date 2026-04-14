// =============================================================
// Edge Function: notify-slack
// Envía mensajes compactos al canal privado de Hardware en Slack.
// Eventos: new_order, status_change
// =============================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface SlackPayload {
  event: 'new_order' | 'status_change'
  order_id: string
  operation_id: string
  customer_name: string
  venue_name?: string | null
  requester_name?: string | null
  status: string
  from_status?: string | null
  changed_by?: string | null
  comment?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  nuevo:                  'Nuevo',
  pendiente:              'Pendiente',
  enviado_proveedor:      'Enviado desde proveedor',
  enviado:                'Enviado',
  pagado:                 'Pagado',
  falta_informacion:      'Falta informacion',
  bloqueado:              'Bloqueado',
  completado:             'Completado',
}

function buildMessage(payload: SlackPayload, appUrl: string): object {
  const orderUrl = `${appUrl}/orders/${payload.order_id}`
  const link = `<${orderUrl}|${payload.operation_id}>`

  if (payload.event === 'new_order') {
    const lines = [
      `*:inbox_tray: Nuevo pedido ${link}*`,
      '',
      `*Cliente:* ${payload.customer_name}`,
      ...(payload.venue_name ? [`*Local:* ${payload.venue_name}`] : []),
      ...(payload.requester_name ? [`*Solicitante:* ${payload.requester_name}`] : []),
    ]

    return {
      text: `Nuevo pedido ${payload.operation_id}`,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: lines.join('\n') },
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

  // status_change
  const fromLabel = payload.from_status ? (STATUS_LABELS[payload.from_status] ?? payload.from_status) : '—'
  const toLabel = STATUS_LABELS[payload.status] ?? payload.status

  const lines = [
    `*:arrows_counterclockwise: ${link} · ${fromLabel} → ${toLabel}*`,
    '',
    `*Cliente:* ${payload.customer_name}`,
    ...(payload.venue_name ? [`*Local:* ${payload.venue_name}`] : []),
    ...(payload.requester_name ? [`*Solicitante:* ${payload.requester_name}`] : []),
    ...(payload.changed_by ? [`*Por:* ${payload.changed_by}`] : []),
    ...(payload.comment ? ['', `> ${payload.comment}`] : []),
  ]

  return {
    text: `${payload.operation_id} → ${toLabel}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: lines.join('\n') },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Ver pedido', emoji: true },
            url: orderUrl,
          },
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

  // Filtrar eventos irrelevantes
  if (payload.event !== 'new_order' && payload.event !== 'status_change') {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // No notificar cambios triviales (mismo estado → mismo estado)
  if (
    payload.event === 'status_change' &&
    payload.from_status === payload.status
  ) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Silenciar auto-transición nuevo → pendiente (es automática, no acción humana)
  if (
    payload.event === 'status_change' &&
    payload.from_status === 'nuevo' &&
    payload.status === 'pendiente'
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
