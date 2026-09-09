import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTrackingDeltas } from '@/lib/tipsa/client'
import {
  isTerminalEvent,
  loadTipsaConfig,
  resolveOfficialStatus,
} from '@/lib/tipsa/services'
import type { TipsaTrackingDelta } from '@/lib/tipsa/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// El sweep hace N queries a Supabase; damos margen por si hay muchos deltas.
export const maxDuration = 60

// TIPSA rechaza ventanas de mas de 24h en ConsEnvEstIncCambiosEstados
// ("El rango de fechas no puede superar las 24 horas"). Dejamos 30 min de
// colchon para no rozar el limite por desfase de reloj.
const MAX_WINDOW_MS = 23.5 * 3600 * 1000
// Solape hacia atras sobre el cursor para no perder eventos por ese desfase.
const OVERLAP_MS = 5 * 60 * 1000

/**
 * POST /api/cron/tipsa-refresh
 *
 * Sweep periodico del estado de los envios TIPSA. Lo dispara pg_cron desde
 * Supabase cada 30 min (migracion 20260909000003) via net.http_post, con la
 * cabecera X-Cron-Secret leida del Vault.
 *
 * Por que vive aqui y no en una Edge Function: Vercel ya tiene configuradas
 * las credenciales TIPSA (las usa /api/tipsa/create-shipment), asi que no hay
 * que duplicarlas en Supabase. Ademas reutiliza lib/tipsa/client.ts en vez de
 * mantener un segundo cliente SOAP escrito para Deno.
 *
 * Flujo:
 *   1. Auth por X-Cron-Secret.
 *   2. Lee app_settings.tipsa_last_poll_at (cursor).
 *   3. Pide a TIPSA los cambios de estado de la ventana [cursor-5min, now]
 *      con UNA llamada paginada (ConsEnvEstIncCambiosEstados), no una por envio.
 *   4. Agrupa por albaran, inserta en shipping_events, recalcula el estado
 *      oficial y actualiza orders/shipments.
 *   5. Guarda el nuevo cursor.
 */
export async function POST(request: NextRequest) {
  const started = Date.now()

  const expected = process.env.TIPSA_CRON_SECRET
  if (!expected) {
    console.error('[cron/tipsa-refresh] TIPSA_CRON_SECRET no configurada')
    return NextResponse.json(
      { error: 'Endpoint no disponible (config)' },
      { status: 503 },
    )
  }
  if ((request.headers.get('x-cron-secret') ?? '') !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  try {
    // ---- 1. Cursor ----
    const { data: setting, error: settingErr } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'tipsa_last_poll_at')
      .maybeSingle()
    if (settingErr) throw new Error(`app_settings read: ${settingErr.message}`)

    const now = new Date()
    const lastPollRaw = setting?.value
    const lastPoll =
      typeof lastPollRaw === 'string'
        ? new Date(lastPollRaw)
        : new Date(now.getTime() - MAX_WINDOW_MS)

    // 5 min de solape hacia atras: el UNIQUE de shipping_events descarta lo
    // repetido y asi no perdemos eventos por desfase de reloj con TIPSA.
    const desiredSince = new Date(lastPoll.getTime() - OVERLAP_MS)
    // TIPSA rechaza ventanas > 24h ("El rango de fechas no puede superar las
    // 24 horas"), asi que la recortamos. Si el cron ha estado parado mas de un
    // dia, esta pasada solo cubre las ultimas 23h; el resto se recupera
    // pulsando "Actualizar" en la ficha del envio concreto.
    const earliestAllowed = new Date(now.getTime() - MAX_WINDOW_MS)
    const sinceDate = desiredSince < earliestAllowed ? earliestAllowed : desiredSince

    const truncated = desiredSince < earliestAllowed
    const since = sinceDate.toISOString()
    const until = now.toISOString()
    if (truncated) {
      console.warn(
        `[cron/tipsa-refresh] cursor ${lastPoll.toISOString()} mas viejo que 24h; ventana recortada a ${since}`,
      )
    }

    // ---- 2. Deltas TIPSA ----
    const config = loadTipsaConfig()
    const deltas = await fetchTrackingDeltas(config, since, until)
    console.log(
      `[cron/tipsa-refresh] ventana ${since} -> ${until} · ${deltas.length} deltas`,
    )

    if (deltas.length === 0) {
      await saveCursor(admin, now)
      return NextResponse.json({
        ok: true,
        processed: 0,
        updated_orders: 0,
        updated_shipments: 0,
        deltas_received: 0,
        duration_ms: Date.now() - started,
      })
    }

    // ---- 3. Agrupar por albaran ----
    const byAlbaran = new Map<string, TipsaTrackingDelta[]>()
    for (const d of deltas) {
      const list = byAlbaran.get(d.albaran) ?? []
      list.push(d)
      byAlbaran.set(d.albaran, list)
    }

    let updatedOrders = 0
    let updatedShipments = 0
    let processed = 0
    let notFound = 0

    for (const [albaran, group] of byAlbaran) {
      const parent = await findParent(admin, albaran)
      if (!parent) {
        notFound += 1
        continue
      }

      const fkColumn = parent.table === 'orders' ? 'order_id' : 'shipment_id'

      // Insertar eventos. El UNIQUE (order_id|shipment_id, carrier, event_code,
      // event_date) hace de dedupe: 23505 significa "ya lo teniamos".
      for (const d of group) {
        const { error } = await admin.from('shipping_events').insert({
          [fkColumn]: parent.id,
          carrier: 'tipsa',
          event_code: d.code,
          event_label: d.label,
          event_date: d.date,
          raw_payload: d.rawAttributes,
        })
        if (error && error.code !== '23505') {
          console.error(
            `[cron/tipsa-refresh] insert event ${albaran}:`,
            error.message,
          )
        }
      }

      // Recalcular el estado oficial sobre TODOS los eventos del envio, no
      // solo los recien llegados: el codigo 3 post-entrega no debe pisar al 2.
      const { data: allEvents } = await admin
        .from('shipping_events')
        .select('event_code, event_date')
        .eq(fkColumn, parent.id)
        .order('event_date', { ascending: true })

      const official = resolveOfficialStatus(
        (allEvents ?? []) as Array<{ event_code: string; event_date: string }>,
        (e) => e.event_code,
      )
      if (!official) {
        processed += 1
        continue
      }

      const updates: Record<string, unknown> = {
        tracking_last_status: official.event_code,
        tracking_last_checked_at: now.toISOString(),
      }
      if (isTerminalEvent(official.event_code)) {
        updates.delivered_at = official.event_date
      }

      const { error: updErr } = await admin
        .from(parent.table)
        .update(updates)
        .eq('id', parent.id)
      if (updErr) {
        console.error(
          `[cron/tipsa-refresh] update ${parent.table}:`,
          updErr.message,
        )
      } else if (parent.table === 'orders') {
        updatedOrders += 1
      } else {
        updatedShipments += 1
      }
      processed += 1
    }

    await saveCursor(admin, now)

    return NextResponse.json({
      ok: true,
      processed,
      updated_orders: updatedOrders,
      updated_shipments: updatedShipments,
      deltas_received: deltas.length,
      albaranes_unicos: byAlbaran.size,
      albaranes_desconocidos: notFound,
      duration_ms: Date.now() - started,
    })
  } catch (err) {
    const e = err as Error
    console.error('[cron/tipsa-refresh] fatal:', e.message)
    return NextResponse.json(
      { error: e.message, duration_ms: Date.now() - started },
      { status: 500 },
    )
  }
}

// Permitir GET para poder dispararlo a mano desde el navegador o curl
// sin montar un POST. Misma logica y misma auth.
export async function GET(request: NextRequest) {
  return POST(request)
}

// ---------------------------------------------------------------------------

type AdminClient = ReturnType<typeof createAdminClient>

/** Busca el albaran primero en orders y, si no aparece, en shipments. */
async function findParent(
  admin: AdminClient,
  albaran: string,
): Promise<{ table: 'orders' | 'shipments'; id: string } | null> {
  const { data: order } = await admin
    .from('orders')
    .select('id')
    .eq('tracking_number', albaran)
    .maybeSingle()
  if (order) return { table: 'orders', id: order.id as string }

  const { data: shipment } = await admin
    .from('shipments')
    .select('id')
    .eq('tracking_number', albaran)
    .maybeSingle()
  if (shipment) return { table: 'shipments', id: shipment.id as string }

  return null
}

async function saveCursor(admin: AdminClient, at: Date): Promise<void> {
  const { error } = await admin
    .from('app_settings')
    .upsert({ key: 'tipsa_last_poll_at', value: at.toISOString() })
  if (error) {
    console.error('[cron/tipsa-refresh] guardar cursor:', error.message)
  }
}
