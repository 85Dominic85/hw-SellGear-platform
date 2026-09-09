import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTracking } from '@/lib/tipsa/client'
import {
  isTerminalEvent,
  loadTipsaConfig,
  resolveOfficialStatus,
  TIPSA_TERMINAL_CODES,
} from '@/lib/tipsa/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Cada ConsEnvEstados tarda ~2s. 20 caben de sobra en los 60s de Vercel. */
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 25

/**
 * POST /api/cron/tipsa-backfill?limit=20
 *
 * Pasada UNICA de recuperacion de historial. No la programa nadie: se lanza a
 * mano las veces que haga falta y despues se puede olvidar.
 *
 * POR QUE HACE FALTA
 * El barrido periodico (tipsa-refresh) solo mira la ventana de 24h del feed de
 * deltas, asi que un envio que se movio antes de que existiera el cron no lo
 * trae nadie. A 09/09/2026 eso eran 239 envios sin consultar jamas — mostraban
 * "Documentado", que ni siquiera es un estado que haya dicho TIPSA sino el
 * evento que escribimos nosotros al crear el envio — y 44 congelados en el
 * estado que tuvieran el dia que alguien pulso "Actualizar", alguno de julio.
 * En total 283 de 292 envios enseñaban algo que no era verdad.
 *
 * QUE HACE
 * Coge los envios que NO estan en un estado terminal (3 Entregado / 5 Devuelto)
 * empezando por los mas desatendidos, y les pide su historial autoritativo con
 * ConsEnvEstados. Los terminales se saltan: ya no se mueven y consultarlos solo
 * gasta llamadas.
 *
 * Va por lotes porque son ~2s por albaran y Vercel corta a 60s. Devuelve
 * `quedan_aprox` para saber cuando parar:
 *
 *   curl -X POST -H "X-Cron-Secret: $SECRET" \
 *     "https://<app>/api/cron/tipsa-backfill?limit=20"
 *
 * Es idempotente: el UNIQUE de shipping_events descarta lo ya guardado, y como
 * ordena por tracking_last_checked_at ascendente cada llamada ataca a los que
 * llevan mas tiempo sin tocarse. Repetirlo no duplica nada.
 */
export async function POST(request: NextRequest) {
  const started = Date.now()

  const expected = process.env.TIPSA_CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'Endpoint no disponible (config)' },
      { status: 503 },
    )
  }
  if ((request.headers.get('x-cron-secret') ?? '') !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const raw = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(raw)
    ? Math.min(Math.max(raw, 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  const admin = createAdminClient()
  const terminal = [...TIPSA_TERMINAL_CODES]
  // PostgREST: "no terminal" incluye los que aun no tienen estado.
  const noTerminal = `tracking_last_status.is.null,tracking_last_status.not.in.(${terminal.join(',')})`

  try {
    const config = loadTipsaConfig()

    const [orders, shipments, pendientes] = await Promise.all([
      admin
        .from('orders')
        .select('id, tracking_number')
        .eq('carrier', 'tipsa')
        .not('tracking_number', 'is', null)
        .or(noTerminal)
        .order('tracking_last_checked_at', { ascending: true, nullsFirst: true })
        .limit(limit),
      admin
        .from('shipments')
        .select('id, tracking_number')
        .not('tracking_number', 'is', null)
        .or(noTerminal)
        .order('tracking_last_checked_at', { ascending: true, nullsFirst: true })
        .limit(limit),
      contarPendientes(admin, noTerminal),
    ])

    const cola: Array<{ table: 'orders' | 'shipments'; id: string; albaran: string }> = [
      ...(orders.data ?? []).map((o) => ({
        table: 'orders' as const,
        id: o.id as string,
        albaran: o.tracking_number as string,
      })),
      ...(shipments.data ?? []).map((s) => ({
        table: 'shipments' as const,
        id: s.id as string,
        albaran: s.tracking_number as string,
      })),
    ].slice(0, limit)

    let procesados = 0
    let fallidos = 0
    let eventosNuevos = 0
    let terminados = 0

    for (const item of cola) {
      const fk = item.table === 'orders' ? 'order_id' : 'shipment_id'

      let events
      try {
        events = (await fetchTracking(config, item.albaran)).events
      } catch (err) {
        fallidos += 1
        console.error(
          `[cron/tipsa-backfill] ${item.albaran}:`,
          (err as Error).message,
        )
        continue
      }

      for (const ev of events) {
        const { error } = await admin.from('shipping_events').insert({
          [fk]: item.id,
          carrier: 'tipsa',
          event_code: ev.code,
          event_label: ev.label,
          event_date: ev.date,
          raw_payload: ev.rawAttributes,
        })
        if (!error) {
          eventosNuevos += 1
        } else if (error.code !== '23505') {
          console.error(
            `[cron/tipsa-backfill] insert ${item.albaran}:`,
            error.message,
          )
        }
      }

      const { data: todos } = await admin
        .from('shipping_events')
        .select('event_code, event_date')
        .eq(fk, item.id)
        .order('event_date', { ascending: true })
        .order('id', { ascending: true })

      const oficial = resolveOfficialStatus(
        (todos ?? []) as Array<{ event_code: string; event_date: string }>,
        (e) => e.event_code,
      )

      const updates: Record<string, unknown> = {
        tracking_last_checked_at: new Date().toISOString(),
      }
      if (oficial) {
        updates.tracking_last_status = oficial.event_code
        // Igual que en el barrido: delivered_at solo en shipments. En orders esa
        // columna es del flujo del pedido (trigger orders_auto_delivered_at) y
        // de ella comen las metricas de SLA.
        if (item.table === 'shipments' && isTerminalEvent(oficial.event_code)) {
          updates.delivered_at = oficial.event_date
        }
        if (isTerminalEvent(oficial.event_code)) terminados += 1
      }

      const { error: updErr } = await admin
        .from(item.table)
        .update(updates)
        .eq('id', item.id)
      if (updErr) {
        console.error(`[cron/tipsa-backfill] update ${item.table}:`, updErr.message)
      }
      procesados += 1
    }

    return NextResponse.json({
      ok: true,
      procesados,
      fallidos,
      eventos_nuevos: eventosNuevos,
      pasan_a_terminal: terminados,
      quedaban_antes: pendientes,
      quedan_aprox: Math.max(0, pendientes - terminados),
      duration_ms: Date.now() - started,
    })
  } catch (err) {
    const e = err as Error
    console.error('[cron/tipsa-backfill] fatal:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

type AdminClient = ReturnType<typeof createAdminClient>

async function contarPendientes(
  admin: AdminClient,
  noTerminal: string,
): Promise<number> {
  const [o, s] = await Promise.all([
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('carrier', 'tipsa')
      .not('tracking_number', 'is', null)
      .or(noTerminal),
    admin
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .not('tracking_number', 'is', null)
      .or(noTerminal),
  ])
  return (o.count ?? 0) + (s.count ?? 0)
}
