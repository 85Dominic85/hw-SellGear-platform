// =============================================================================
// Cliente SOAP TIPSA minimo para Deno (Edge Functions).
// Soporta lo necesario para el cron: Login + ConsEnvEstIncCambiosEstados.
// Espejo del cliente Node de apps/web/lib/tipsa (no compartible por
// diferencia de runtimes).
// =============================================================================

import { formatTipsaRequestDate, parseTipsaDate, tipsaEventLabel } from './tipsa-status.ts'

export type TipsaEnv = 'test' | 'prod'

export const TIPSA_URLS = {
  test: {
    login: 'https://wsval.tipsa-dinapaq.com/SOAP?service=LoginWSService',
    webserv: 'https://wsval.tipsa-dinapaq.com/SOAP?service=WebServService',
  },
  prod: {
    login: 'https://ws.tipsa-dinapaq.com/SOAP?service=LoginWSService',
    webserv: 'https://ws.tipsa-dinapaq.com/SOAP?service=WebServService',
  },
} as const satisfies Record<TipsaEnv, { login: string; webserv: string }>

export interface TipsaCredentials {
  agencyCode: string
  clientCode: string
  password: string
}

export interface TipsaTrackingDelta {
  albaran: string
  code: string
  label: string
  date: string // ISO UTC
  rawAttributes: Record<string, string>
}

/**
 * XML-safe: TIPSA acepta UTF-8; escapamos &, <, >, ", '.
 */
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

// =============================================================================
// LOGIN
// =============================================================================

export interface TipsaSession {
  sessionId: string
  trackingBaseUrl: string | null
}

export async function tipsaLogin(env: TipsaEnv, creds: TipsaCredentials): Promise<TipsaSession> {
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

  // Buscar strSesion en la respuesta. Aceptamos LoginCli2Response y LoginCliResponse.
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

// =============================================================================
// ConsEnvEstIncCambiosEstados (deltas por ventana + paginacion)
// =============================================================================

/**
 * Recorre todas las paginas de deltas hasta agotar. maxPages es un salvavidas
 * para no colgarse si TIPSA devuelve mal iTotalPaginasOut.
 */
export async function fetchTrackingDeltas(
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

    // Extraer el CDATA de strEnvEstIncCambioEstado.
    const cdataMatch = xml.match(
      /<[^>]*:strEnvEstIncCambioEstado><!\[CDATA\[([\s\S]*?)\]\]><\/[^>]*:strEnvEstIncCambioEstado>/,
    )
    const totalPagesMatch = xml.match(/<[^>]*:iTotalPaginasOut>(\d+)<\/[^>]*:iTotalPaginasOut>/)
    const totalPages = totalPagesMatch ? Number(totalPagesMatch[1]) : 1

    if (cdataMatch) {
      const deltas = parseDeltasCdata(cdataMatch[1])
      all.push(...deltas)
    }

    if (page + 1 >= totalPages) break
  }
  return all
}

/**
 * Extrae los eventos ENV_EST_INC_CAMBIOS_ESTADOS del CDATA usando regex.
 * Los atributos que necesitamos son V_ALBARAN, V_COD_TIPO_EST, D_FEC_HORA_ALTA_EST
 * (fecha del evento) y V_OBS_INC (observacion si es incidencia).
 * Regex simple + attribute parser evita traer una lib XML a Deno.
 */
function parseDeltasCdata(cdata: string): TipsaTrackingDelta[] {
  const out: TipsaTrackingDelta[] = []
  // Cada nodo va como <ENV_EST_INC_CAMBIOS_ESTADOS attr1="v1" attr2="v2" .../>
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

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRegex = /(\w+)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(raw)) !== null) {
    attrs[match[1]] = match[2]
  }
  return attrs
}
