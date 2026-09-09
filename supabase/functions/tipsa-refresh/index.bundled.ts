// =============================================================================
// Edge Function: tipsa-refresh (VERSION CONSOLIDADA — un solo archivo)
// -----------------------------------------------------------------------------
// Identica en comportamiento a tipsa-refresh/index.ts + _shared/tipsa-soap.ts +
// _shared/tipsa-status.ts, pero con todo inline para poder pegarla directamente
// en el editor del Dashboard de Supabase (Edge Functions -> Deploy new function),
// que no soporta imports relativos entre ficheros.
//
// La version canonica sigue siendo la de 3 ficheros (deploy via CLI). Si cambias
// una, cambia la otra.
//
// Cron sweep TIPSA: consulta deltas de estados en la ventana desde el ultimo
// poll hasta ahora, actualiza shipping_events + orders/shipments, guarda el
// nuevo last_poll_at.
//
// Trigger: pg_cron */30 min via net.http_post (migracion 20260909000003).
// Auth: header X-Cron-Secret == env TIPSA_CRON_SECRET.
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// =============================================================================
// CORS
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// =============================================================================
// Helpers de estado TIPSA (espejo de _shared/tipsa-status.ts)
// =============================================================================

const TIPSA_EVENT_LABELS: Record<string, string> = {
  '0': 'Documentado',
  '1': 'Alta',
  '2': 'Entregado',
  '3': 'Incidencia',
  '4': 'En tránsito',
  '5': 'En reparto',
  '6': 'Devuelto al origen',
  '7': 'Lectura en agencia',
  '8': 'En reparto',
  '10': 'En delegación destino',
  '11': 'En reparto',
  '15': 'Pendiente de llegada',
  '18': 'En tránsito interno',
}

function tipsaEventLabel(code: string): string {
  return TIPSA_EVENT_LABELS[code] ?? `Estado ${code}`
}

/** Codigos "finales": el envio llego a su ultimo destino. */
const TIPSA_TERMINAL_CODES = new Set<string>(['2', '6'])

function isTerminalEvent(code: string): boolean {
  return TIPSA_TERMINAL_CODES.has(code)
}

/** Codigo "anotacion" — un 3 tras un 2 no cambia el estado oficial. */
const NOTE_CODE = '3'

/**
 * Estado oficial ignorando anotaciones post-entrega (codigo 3 tras codigo 2).
 * Asume events ordenados cronologicamente ASCENDENTE.
 */
function resolveOfficialStatus<T>(events: T[], getCode: (e: T) => string): T | null {
  if (events.length === 0) return null
  for (let i = events.length - 1; i >= 0; i--) {
    if (getCode(events[i]) !== NOTE_CODE) return events[i]
  }
  return events[events.length - 1]
}

/**
 * Fecha TIPSA "MM/DD/YYYY HH:MM:SS" -> ISO UTC.
 * TIPSA emite MM/DD (formato US) en hora local Madrid, sin sufijo de zona.
 * El DST se resuelve con Intl.DateTimeFormat sobre 'Europe/Madrid'.
 */
function parseTipsaDate(raw: string): string {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return new Date().toISOString()
  const [, mm, dd, yyyy, hh, mi, ss] = m
  const naiveUtc = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(naiveUtc)).map((p) => [p.type, p.value]),
  )
  const hourVal = parts.hour === '24' ? 0 : +parts.hour
  const madridAsUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    hourVal,
    +parts.minute,
    +parts.second,
  )
  const offsetMs = madridAsUtc - naiveUtc
  return new Date(naiveUtc - offsetMs).toISOString()
}

/**
 * ISO UTC -> "YYYY/MM/DD HH:MM:SS" en hora local Madrid.
 * Es el formato que espera el REQUEST de ConsEnvEstIncCambiosEstados
 * (ojo: el request usa YYYY/MM/DD y la respuesta MM/DD/YYYY — asi es TIPSA).
 */
function formatTipsaRequestDate(isoUtc: string): string {
  const d = new Date(isoUtc)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  const hh = parts.hour === '24' ? '00' : parts.hour
  return `${parts.year}/${parts.month}/${parts.day} ${hh}:${parts.minute}:${parts.second}`
}

// =============================================================================
// Cliente SOAP TIPSA (espejo de _shared/tipsa-soap.ts)
// =============================================================================

type TipsaEnv = 'test' | 'prod'

const TIPSA_URLS = {
  test: {
    login: 'https://wsval.tipsa-dinapaq.com/SOAP?service=LoginWSService',
    webserv: 'https://wsval.tipsa-dinapaq.com/SOAP?service=WebServService',
  },
  prod: {
    login: 'https://ws.tipsa-dinapaq.com/SOAP?service=LoginWSService',
    webserv: 'https://ws.tipsa-dinapaq.com/SOAP?service=WebServService',
  },
} as const satisfies Record<TipsaEnv, { login: string; webserv: string }>

interface TipsaCredentials {
  agencyCode: string
  clientCode: string
  password: string
}

interface TipsaTrackingDelta {
  albaran: string
  code: string
  label: string
  date: string // ISO UTC
  rawAttributes: Record<string, string>
}

function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function postSoap(url: string, body: string, soapAction: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${soapAction}"`,
      'User-Agent': 'qamarero-tipsa-edge/1.0',
      Accept: '*/*',
    },
    body,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`TIPSA HTTP ${res.status} on ${soapAction}: ${text.slice(0, 500)}`)
  }
  if (/<([\w-]+:)?Fault[>\s]/.test(text)) {
    throw new Error(`TIPSA SOAP Fault on ${soapAction}: ${text.slice(0, 500)}`)
  }
  return text
}

interface TipsaSession {
  sessionId: string
  trackingBaseUrl: string | null
}

async function tipsaLogin(env: TipsaEnv, creds: TipsaCredentials): Promise<TipsaSession> {
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">',
    '  <soapenv:Header>',
    '    <tem:ROClientIDHeader></tem:ROClientIDHeader>',
    '  </soapenv:Header>',
    '  <soapenv:Body>',
    '    <tem:LoginWSService___LoginCli2>',
    '      <tem:strCodAge>' + xmlEscape(creds.agencyCode) + '</tem:strCodAge>',
    '      <tem:strCod>' + xmlEscape(creds.clientCode) + '</tem:strCod>',
    '      <tem:strPass>' + xmlEscape(creds.password) + '</tem:strPass>',
    '    </tem:LoginWSService___LoginCli2>',
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n')

  const xml = await postSoap(TIPSA_URLS[env].login, body, 'urn:DinaPaq-LoginWSService#LoginCli2')

  const sessionMatch = xml.match(/<[^>]*:strSesion>([^<]+)<\/[^>]*:strSesion>/)
  if (!sessionMatch) {
    throw new Error(`Login TIPSA sin strSesion. Body: ${xml.slice(0, 500)}`)
  }
  const trackingMatch = xml.match(/<[^>]*:strURLDetSegEnv>([^<]+)<\/[^>]*:strURLDetSegEnv>/)
  return {
    sessionId: sessionMatch[1],
    trackingBaseUrl: trackingMatch ? trackingMatch[1] : null,
  }
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRegex = /(\w+)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(raw)) !== null) {
    attrs[match[1]] = match[2]
  }
  return attrs
}

/**
 * Extrae los eventos ENV_EST_INC_CAMBIOS_ESTADOS del CDATA.
 * Campos usados: V_ALBARAN, V_COD_TIPO_EST, D_FEC_HORA_ALTA_EST,
 * y V_OBS_INC (observacion cuando el codigo es 3).
 */
function parseDeltasCdata(cdata: string): TipsaTrackingDelta[] {
  const out: TipsaTrackingDelta[] = []
  const nodeRegex = /<ENV_EST_INC_CAMBIOS_ESTADOS\s+([^/>]+)\/>/g
  let match: RegExpExecArray | null
  while ((match = nodeRegex.exec(cdata)) !== null) {
    const attrs = parseAttrs(match[1])
    const albaran = attrs['V_ALBARAN'] ?? ''
    const code = attrs['V_COD_TIPO_EST'] ?? ''
    const dateStr = attrs['D_FEC_HORA_ALTA_EST'] ?? ''
    if (!albaran || !code) continue
    out.push({
      albaran,
      code,
      label: tipsaEventLabel(code),
      date: parseTipsaDate(dateStr),
      rawAttributes: attrs,
    })
  }
  return out
}

/**
 * Recorre todas las paginas de deltas hasta agotar. maxPages es un salvavidas
 * por si TIPSA devuelve mal iTotalPaginasOut.
 */
async function fetchTrackingDeltas(
  env: TipsaEnv,
  sessionId: string,
  sinceIsoUtc: string,
  untilIsoUtc: string,
  maxPages = 50,
): Promise<TipsaTrackingDelta[]> {
  const all: TipsaTrackingDelta[] = []
  const since = formatTipsaRequestDate(sinceIsoUtc)
  const until = formatTipsaRequestDate(untilIsoUtc)

  for (let page = 0; page < maxPages; page++) {
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">',
      '  <soapenv:Header>',
      '    <tem:ROClientIDHeader>',
      '      <tem:ID>' + xmlEscape(sessionId) + '</tem:ID>',
      '    </tem:ROClientIDHeader>',
      '  </soapenv:Header>',
      '  <soapenv:Body>',
      '    <tem:WebServService___ConsEnvEstIncCambiosEstados>',
      '      <tem:dtFecHoraEstadoInicio>' + xmlEscape(since) + '</tem:dtFecHoraEstadoInicio>',
      '      <tem:dtFecHoraEstadoFin>' + xmlEscape(until) + '</tem:dtFecHoraEstadoFin>',
      '      <tem:iPagina>' + page + '</tem:iPagina>',
      '    </tem:WebServService___ConsEnvEstIncCambiosEstados>',
      '  </soapenv:Body>',
      '</soapenv:Envelope>',
    ].join('\n')

    const xml = await postSoap(
      TIPSA_URLS[env].webserv,
      body,
      'urn:DinaPaq-WebServService#ConsEnvEstIncCambiosEstados',
    )

    const cdataMatch = xml.match(
      /<[^>]*:strEnvEstIncCambioEstado><!\[CDATA\[([\s\S]*?)\]\]><\/[^>]*:strEnvEstIncCambioEstado>/,
    )
    const totalPagesMatch = xml.match(/<[^>]*:iTotalPaginasOut>(\d+)<\/[^>]*:iTotalPaginasOut>/)
    const totalPages = totalPagesMatch ? Number(totalPagesMatch[1]) : 1

    if (cdataMatch) {
      all.push(...parseDeltasCdata(cdataMatch[1]))
    }

    if (page + 1 >= totalPages) break
  }
  return all
}

// =============================================================================
// Handler
// =============================================================================

const CRON_SECRET = Deno.env.get('TIPSA_CRON_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const TIPSA_ENV = (Deno.env.get('TIPSA_ENV') ?? 'test') as TipsaEnv

function tipsaCredsFromEnv(): TipsaCredentials {
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

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const started = Date.now()

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
    // 5 min de solape hacia atras para no perder eventos por desfase de reloj.
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
      const { data: orderRow } = await admin
        .from('orders')
        .select('id')
        .eq('tracking_number', albaran)
        .maybeSingle()

      let parent: { table: 'orders' | 'shipments'; id: string } | null = null
      if (orderRow) {
        parent = { table: 'orders', id: orderRow.id }
      } else {
        const { data: shipRow } = await admin
          .from('shipments')
          .select('id')
          .eq('tracking_number', albaran)
          .maybeSingle()
        if (shipRow) parent = { table: 'shipments', id: shipRow.id }
      }

      if (!parent) {
        console.log(`[tipsa-refresh] albaran ${albaran} no encontrado en DB; skip`)
        continue
      }

      // Insertar deltas. El UNIQUE de shipping_events gestiona duplicados
      // cuando dos ticks se solapan: ignoramos la violacion 23505.
      const rows = group.map((d) => ({
        [parent!.table === 'orders' ? 'order_id' : 'shipment_id']: parent!.id,
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

      // Recalcular el estado oficial sobre TODOS los eventos del envio.
      const filterCol = parent.table === 'orders' ? 'order_id' : 'shipment_id'
      const { data: allEvents } = await admin
        .from('shipping_events')
        .select('event_code, event_date')
        .eq(filterCol, parent.id)
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
        console.error(`[tipsa-refresh] update ${parent.table} error:`, updErr.message)
      } else if (parent.table === 'orders') {
        updatedOrders += 1
      } else {
        updatedShipments += 1
      }
      processed += 1
    }

    // 5) Guardar el nuevo cursor.
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
