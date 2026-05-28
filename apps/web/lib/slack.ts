// =============================================================
// Slack notifications — server-side only.
//
// Postea al Incoming Webhook del canal de Hardware (SLACK_WEBHOOK_URL,
// Vercel env). Compone menciones (@here + creador + personas fijas por
// categoría) y mensajes Blocks. NUNCA lanza: un fallo de Slack no rompe
// la operación del pedido. No-op silencioso si SLACK_WEBHOOK_URL no está.
//
// Eventos soportados:
//   - new_order
//   - status_change (filtrado: solo SLACK_NOTIFY_STATUSES)
//   - message_to_hardware
//   - financing_payment
// =============================================================

import type { PurchaseType } from '@/types/database'

const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  pendiente: 'Pendiente',
  enviado_proveedor: 'Enviado desde proveedor',
  enviado: 'Enviado',
  pagado: 'Pagado',
  falta_informacion: 'Falta información',
  bloqueado: 'Bloqueado',
  completado: 'Completado',
}

/** Estados que generan aviso a Slack. Resto = silencio (sin ruido). */
export const SLACK_NOTIFY_STATUSES: ReadonlySet<string> = new Set([
  'enviado_proveedor',
  'enviado',
  'pagado',
  'falta_informacion',
  'bloqueado',
  'completado',
])

export type SlackNotifyEvent =
  | 'new_order'
  | 'status_change'
  | 'message_to_hardware'
  | 'financing_payment'

interface OrderContext {
  order_id: string
  operation_id: string
  customer_name: string
  venue_name?: string | null
  requester_name?: string | null
  purchase_type?: PurchaseType | null
}

export interface NewOrderCtx extends OrderContext {
  event: 'new_order'
}

export interface StatusChangeCtx extends OrderContext {
  event: 'status_change'
  from_status: string | null
  to_status: string
  changed_by?: string | null
  comment?: string | null
  /** Slack user ID del creador (mención en falta_informacion). */
  creator_slack_user_id?: string | null
}

export interface MessageToHardwareCtx extends OrderContext {
  event: 'message_to_hardware'
  author_name: string
  author_role?: string | null
  message: string
}

export interface FinancingPaymentCtx extends OrderContext {
  event: 'financing_payment'
  installment_no: 1 | 2 | 3
  amount_cents: number
}

export type NotifyCtx =
  | NewOrderCtx
  | StatusChangeCtx
  | MessageToHardwareCtx
  | FinancingPaymentCtx

// =============================================================
// Menciones
// =============================================================

/**
 * "<!here> <@U1> <@U2>" — filtra vacíos, deduplica. Cadena vacía si nada.
 */
export function formatMentions(
  ids: ReadonlyArray<string | null | undefined>,
  opts: { here?: boolean } = {},
): string {
  const seen = new Set<string>()
  const parts: string[] = []
  if (opts.here) parts.push('<!here>')
  for (const id of ids) {
    if (!id) continue
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    parts.push(`<@${trimmed}>`)
  }
  return parts.join(' ')
}

/**
 * Lee SLACK_CATEGORY_MENTIONS (env JSON) y devuelve los Slack IDs fijos
 * para una purchase_type. Fallback a "default" si el tipo no tiene match.
 * Devuelve [] si la JSON es inválida o el env no existe.
 *
 * Formato esperado:
 *   {"hardware_financiacion":["U0123"],"kit_digital":["U0456"],"default":["U0789"]}
 */
export function resolveCategoryMentions(
  purchaseType: PurchaseType | null | undefined,
): string[] {
  const raw = process.env.SLACK_CATEGORY_MENTIONS
  if (!raw) return []
  let map: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    map = parsed as Record<string, unknown>
  } catch {
    console.error('SLACK_CATEGORY_MENTIONS: JSON inválido, ignorando.')
    return []
  }
  const key = purchaseType ?? 'default'
  const fromKey = map[key]
  const fromDefault = map['default']
  const pick: unknown[] = Array.isArray(fromKey)
    ? fromKey
    : Array.isArray(fromDefault)
      ? fromDefault
      : []
  return pick.filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  )
}

/** Menciones por evento (creador + categoría + @here según el caso). */
function resolveMentionsForEvent(ctx: NotifyCtx): string {
  const categoryIds = resolveCategoryMentions(ctx.purchase_type)
  switch (ctx.event) {
    case 'new_order':
    case 'message_to_hardware':
      return formatMentions(categoryIds, { here: true })
    case 'status_change':
      if (ctx.to_status === 'falta_informacion') {
        // Ping al creador para que complete; categoría también si configurada.
        return formatMentions([ctx.creator_slack_user_id, ...categoryIds])
      }
      // Resto de estados clave: solo canal, sin ping (bajo ruido).
      return ''
    case 'financing_payment':
      return formatMentions(categoryIds)
  }
}

// =============================================================
// Render del mensaje (Blocks)
// =============================================================

export interface SlackMessage {
  text: string
  blocks: object[]
}

/**
 * Compone text + Blocks para Slack. PURO (sin red ni env). El caller
 * pasa las menciones ya resueltas y el appUrl. Testable con vitest.
 */
export function buildSlackMessage(
  ctx: NotifyCtx,
  mentionsPrefix: string,
  appUrl: string,
): SlackMessage {
  const orderUrl = `${appUrl}/orders/${ctx.order_id}`
  const link = `<${orderUrl}|${ctx.operation_id}>`
  const prefix = mentionsPrefix ? `${mentionsPrefix}\n\n` : ''

  switch (ctx.event) {
    case 'new_order': {
      const lines = [
        `${prefix}*:inbox_tray: Nuevo pedido ${link}*`,
        '',
        `*Cliente:* ${ctx.customer_name}`,
        ...(ctx.venue_name ? [`*Local:* ${ctx.venue_name}`] : []),
        ...(ctx.requester_name ? [`*Solicitante:* ${ctx.requester_name}`] : []),
      ]
      return {
        text: `Nuevo pedido ${ctx.operation_id}`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
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
    case 'status_change': {
      const fromLabel = ctx.from_status
        ? STATUS_LABELS[ctx.from_status] ?? ctx.from_status
        : '—'
      const toLabel = STATUS_LABELS[ctx.to_status] ?? ctx.to_status
      const lines = [
        `${prefix}*:arrows_counterclockwise: ${link} · ${fromLabel} → ${toLabel}*`,
        '',
        `*Cliente:* ${ctx.customer_name}`,
        ...(ctx.venue_name ? [`*Local:* ${ctx.venue_name}`] : []),
        ...(ctx.requester_name ? [`*Solicitante:* ${ctx.requester_name}`] : []),
        ...(ctx.changed_by ? [`*Por:* ${ctx.changed_by}`] : []),
        ...(ctx.comment ? ['', `> ${ctx.comment}`] : []),
      ]
      return {
        text: `${ctx.operation_id} → ${toLabel}`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
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
    case 'message_to_hardware': {
      const author = ctx.author_role
        ? `${ctx.author_name} (${ctx.author_role})`
        : ctx.author_name
      const quoted = ctx.message.replace(/\n/g, '\n> ')
      const lines = [
        `${prefix}*:speech_balloon: Mensaje para Hardware · ${link}*`,
        '',
        `*Cliente:* ${ctx.customer_name}`,
        ...(ctx.venue_name ? [`*Local:* ${ctx.venue_name}`] : []),
        `*De:* ${author}`,
        '',
        `> ${quoted}`,
      ]
      return {
        text: `Mensaje para Hardware (${ctx.operation_id})`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
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
    case 'financing_payment': {
      const stageLabel =
        ctx.installment_no === 1
          ? 'Entrada (1.º)'
          : `${ctx.installment_no}.º plazo`
      const importe = (ctx.amount_cents / 100).toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
      })
      const lines = [
        `${prefix}*:moneybag: Pago de financiación · ${link}*`,
        '',
        `*Cliente:* ${ctx.customer_name}`,
        ...(ctx.venue_name ? [`*Local:* ${ctx.venue_name}`] : []),
        `*Plazo:* ${stageLabel} — *Importe:* ${importe}`,
      ]
      return {
        text: `Pago financiación ${ctx.operation_id} (plazo ${ctx.installment_no})`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
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
  }
}

// =============================================================
// Envío
// =============================================================

export interface SlackResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

/**
 * Postea al webhook. No-op silencioso si SLACK_WEBHOOK_URL no está.
 * Nunca lanza: devuelve { ok, error? }.
 */
export async function postToSlack(message: SlackMessage): Promise<SlackResult> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) {
    console.warn('[slack] SLACK_WEBHOOK_URL no configurado; mensaje omitido.')
    return { ok: true, skipped: true }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      const error = detail || `HTTP ${res.status}`
      console.error('[slack] post falló:', error)
      return { ok: false, error }
    }
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[slack] post falló:', error)
    return { ok: false, error }
  }
}

/**
 * API de alto nivel: arma menciones según el evento, construye el mensaje
 * y postea. NUNCA lanza. Filtra status_change que no estén en
 * SLACK_NOTIFY_STATUSES (sin aviso → menos ruido en el canal).
 */
export async function notifyOrderEvent(ctx: NotifyCtx): Promise<SlackResult> {
  if (
    ctx.event === 'status_change' &&
    !SLACK_NOTIFY_STATUSES.has(ctx.to_status)
  ) {
    return { ok: true, skipped: true }
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app'
  const mentions = resolveMentionsForEvent(ctx)
  const message = buildSlackMessage(ctx, mentions, appUrl)
  return postToSlack(message)
}
