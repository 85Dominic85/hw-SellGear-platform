import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PURCHASE_TYPE_LABELS, formatCurrency } from '@/lib/utils'
import type { PurchaseType, OrderStatus } from '@/types/database'

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  pendiente: 'Pendiente',
  solicitado_a_proveedor: 'Solicitado a proveedor',
  pagado: 'Pagado',
  falta_informacion: 'Falta informacion',
  bloqueado: 'Bloqueado',
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!SLACK_WEBHOOK_URL) {
    return NextResponse.json(
      { error: 'Slack no esta configurado. Añade SLACK_WEBHOOK_URL en las variables de entorno.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      status_history(from_status, to_status, changed_at, comment)
    `)
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const history = (order.status_history ?? [])
    .sort((a: { changed_at: string }, b: { changed_at: string }) =>
      new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
    )
    .slice(0, 5)

  const purchaseLabel = order.purchase_type
    ? PURCHASE_TYPE_LABELS[order.purchase_type as PurchaseType] ?? order.purchase_type
    : 'Sin tipo'

  const statusLabel = STATUS_LABELS[order.status] ?? order.status

  // Build Slack Block Kit message
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📦 ${order.operation_id} — ${order.customer_name}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Estado:*\n${statusLabel}` },
        { type: 'mrkdwn', text: `*Tipo:*\n${purchaseLabel}` },
        { type: 'mrkdwn', text: `*Importe:*\n${formatCurrency(order.amount)}` },
        { type: 'mrkdwn', text: `*Proveedor:*\n${order.supplier ?? 'Sin asignar'}` },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Local:*\n${order.venue_name ?? '—'}` },
        { type: 'mrkdwn', text: `*Telefono:*\n${order.phone ?? '—'}` },
        ...(order.ae_ref ? [{ type: 'mrkdwn', text: `*AE:*\n${order.ae_ref}` }] : []),
        ...(order.shipping_address ? [{ type: 'mrkdwn', text: `*Envio:*\n${order.shipping_address}` }] : []),
      ],
    },
  ]

  if (history.length > 0) {
    const historyText = history
      .map((h: { from_status: OrderStatus | null; to_status: OrderStatus; changed_at: string; comment: string | null }) => {
        const from = h.from_status ? STATUS_LABELS[h.from_status] ?? h.from_status : '—'
        const to = STATUS_LABELS[h.to_status] ?? h.to_status
        const date = new Date(h.changed_at).toLocaleDateString('es-ES', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        })
        return `• ${from} → *${to}* (${date})${h.comment ? ` _${h.comment}_` : ''}`
      })
      .join('\n')

    blocks.push(
      { type: 'divider' } as any,
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Historial de estados:*\n${historyText}` },
      } as any,
    )
  }

  // Send to Slack
  const slackRes = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })

  if (!slackRes.ok) {
    return NextResponse.json({ error: 'Error al enviar a Slack' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
