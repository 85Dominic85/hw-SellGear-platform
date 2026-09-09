// =============================================================================
// Edge Function: tipsa-refresh
// -----------------------------------------------------------------------------
// Cron sweep TIPSA: consulta deltas de estados en la ventana desde el ultimo
// poll hasta ahora, actualiza shipping_events + orders/shipments, guarda el
// nuevo last_poll_at.
//
// Trigger: pg_cron */30 min via net.http_post (ver migracion 20260909000003).
// Auth: header X-Cron-Secret == env TIPSA_CRON_SECRET.
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  fetchTrackingDeltas,
  tipsaLogin,
  type TipsaEnv,
  type TipsaTrackingDelta,
} from '../_shared/tipsa-soap.ts'
import { isTerminalEvent, resolveOfficialStatus } from '../_shared/tipsa-status.ts'

// --------- Env vars ---------
const CRON_SECRET = Deno.env.get('TIPSA_CRON_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const TIPSA_ENV = (Deno.env.get('TIPSA_ENV') ?? 'test') as TipsaEnv

function tipsaCredsFromEnv() {
  if (TIPSA_ENV === 'prod') {
    return {
      agencyCode: Deno.env.get('TIPSA_PROD_AGENCY_CODE') ?? '',
      clientCode: Deno.env.get('TIPSA_PROD_CLIENT_CODE') ?? '',
      password: Deno.env.get('TIPSA_PROD_PASSWORD') ?? '',
    }
  }
  return {
    agencyCode: Deno.env.get('TIPSA_TEST_AGENCY_CODE') ?? '',
    clientCode: Deno.env.get('TIPSA_TEST_CLIENT_CODE') ?? '',
    password: Deno.env.get('TIPSA_TEST_PASSWORD') ?? '',
  }
}

// --------- Handler ---------

Deno.serve(async (req: Request) => {
  const started = Date.now()

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth: header X-Cron-Secret
  if (!CRON_SECRET) {
    return json({ error: 'TIPSA_CRON_SECRET no configurada' }, 503)
  }
  const provided = req.headers.get('x-cron-secret') ?? ''
  if (provided !== CRON_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: 'SUPABASE env missing' }, 503)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // 1) Leer last_poll_at.
    const { data: setting, error: settingErr } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'tipsa_last_poll_at')
      .maybeSingle()
    if (settingErr) throw new Error(`app_settings read: ${settingErr.message}`)

    // Ventana con 5 min de solape hacia atras para no perder eventos por reloj.
    const now = new Date()
    const lastPollStr =
      typeof setting?.value === 'string'
        ? setting.value
        : setting?.value
          ? String(setting.value)
          : null
    const lastPoll = lastPollStr
      ? new Date(lastPollStr)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const since = new Date(lastPoll.getTime() - 5 * 60 * 1000).toISOString()
    const until = now.toISOString()

    console.log(`[tipsa-refresh] window: ${since} -> ${until}`)

    // 2) Login TIPSA + fetch deltas paginados.
    const session = await tipsaLogin(TIPSA_ENV, tipsaCredsFromEnv())
    const deltas = await fetchTrackingDeltas(TIPSA_ENV, session.sessionId, since, until)
    console.log(`[tipsa-refresh] deltas received: ${deltas.length}`)

    if (deltas.length === 0) {
      await admin
        .from('app_settings')
        .upsert({ key: 'tipsa_last_poll_at', value: now.toISOString() as unknown as never })
      return json({
        ok: true,
        processed: 0,
        updated_orders: 0,
        updated_shipments: 0,
        duration_ms: Date.now() - started,
      })
    }

    // 3) Agrupar deltas por albaran.
    const byAlbaran = new Map<string, TipsaTrackingDelta[]>()
    for (const d of deltas) {
      const list = byAlbaran.get(d.albaran) ?? []
      list.push(d)
      byAlbaran.set(d.albaran, list)
    }

    let updatedOrders = 0
    let updatedShipments = 0
    let processed = 0

    // 4) Por cada albaran: lookup + insert eventos + update fila padre.
    for (const [albaran, group] of byAlbaran) {
      // Lookup en orders. Si no aparece, probar shipments.
      const { data: orderRow } = await admin
        .from('orders')
        .select('id, tracking_number, tracking_last_status, delivered_at')
        .eq('tracking_number', albaran)
        .maybeSingle()

      let parent:
        | { table: 'orders' | 'shipments'; id: string }
        | null = null
      if (orderRow) {
        parent = { table: 'orders', id: orderRow.id }
      } else {
        const { data: shipRow } = await admin
          .from('shipments')
          .select('id, tracking_number, tracking_last_status')
          .eq('tracking_number', albaran)
          .maybeSingle()
        if (shipRow) parent = { table: 'shipments', id: shipRow.id }
      }

      if (!parent) {
        console.log(`[tipsa-refresh] albaran ${albaran} no encontrado en DB; skip`)
        continue
      }

      // Insertar deltas nuevos. UNIQUE (order_id|shipment_id, carrier, event_code, event_date)
      // gestiona duplicados: ignoramos violacion 23505.
      const rows = group.map((d) => ({
        [parent.table === 'orders' ? 'order_id' : 'shipment_id']: parent.id,
        carrier: 'tipsa',
        event_code: d.code,
        event_label: d.label,
        event_date: d.date,
        raw_payload: d.rawAttributes,
      }))
      for (const row of rows) {
        const { error: insErr } = await admin.from('shipping_events').insert(row)
        if (insErr && insErr.code !== '23505') {
          console.error(`[tipsa-refresh] insert event error for ${albaran}:`, insErr.message)
        }
      }

      // Recalcular estado oficial leyendo TODOS los eventos del envio.
      const filter =
        parent.table === 'orders'
          ? { column: 'order_id', value: parent.id }
          : { column: 'shipment_id', value: parent.id }
      const { data: allEvents } = await admin
        .from('shipping_events')
        .select('event_code, event_date')
        .eq(filter.column, filter.value)
        .order('event_date', { ascending: true })

      const official = resolveOfficialStatus(
        allEvents ?? [],
        (e: { event_code: string }) => e.event_code,
      ) as { event_code: string; event_date: string } | null

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
        console.error(`[tipsa-refresh] update ${parent.table} error:`, updErr.message)
      } else if (parent.table === 'orders') {
        updatedOrders += 1
      } else {
        updatedShipments += 1
      }
      processed += 1
    }

    // 5) Escribir nuevo last_poll_at.
    const { error: setErr } = await admin
      .from('app_settings')
      .upsert({ key: 'tipsa_last_poll_at', value: now.toISOString() as unknown as never })
    if (setErr) console.error('[tipsa-refresh] app_settings upsert error:', setErr.message)

    return json({
      ok: true,
      processed,
      updated_orders: updatedOrders,
      updated_shipments: updatedShipments,
      deltas_received: deltas.length,
      albaranes_unicos: byAlbaran.size,
      duration_ms: Date.now() - started,
    })
  } catch (err) {
    const e = err as Error
    console.error('[tipsa-refresh] fatal:', e.message, e.stack)
    return json({ error: e.message, duration_ms: Date.now() - started }, 500)
  }
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
