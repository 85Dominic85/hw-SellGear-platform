import { XMLParser } from 'fast-xml-parser'
import { tipsaEventLabel } from './services'
import type {
  TipsaCreateShipmentInput,
  TipsaCreateShipmentResult,
  TipsaCredentials,
  TipsaLabelFormat,
  TipsaLabelResult,
  TipsaLoginResult,
  TipsaSender,
  TipsaShippingEvent,
  TipsaTrackingResult,
} from './types'

/**
 * Escape XML seguro para texto dentro de tags.
 * TIPSA acepta UTF-8; escapamos &, <, > y comillas.
 */
export function xmlEscape(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const SHARED_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
})

// =========================================================
// LOGIN
// =========================================================

export function buildLoginEnvelope(creds: TipsaCredentials): string {
  // Construido via array + join('\n') para evitar cualquier transformacion
  // de template literals por Turbopack/Next.js que altere bytes del payload.
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">',
    '  <soapenv:Header>',
    '    <tem:ROClientIDHeader>',
    '    </tem:ROClientIDHeader>',
    '  </soapenv:Header>',
    '  <soapenv:Body>',
    '    <tem:LoginWSService___LoginCli2>',
    '      <tem:strCodAge>' + xmlEscape(creds.agencyCode) + '</tem:strCodAge>',
    '      <tem:strCod>' + xmlEscape(creds.clientCode) + '</tem:strCod>',
    '      <tem:strPass>' + xmlEscape(creds.password) + '</tem:strPass>',
    '    </tem:LoginWSService___LoginCli2>',
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ]
  return lines.join('\n')
}

export function parseLoginResponse(xml: string): TipsaLoginResult {
  const parsed = SHARED_PARSER.parse(xml)
  // Acepta ambos: LoginCli2Response (nuevo) y LoginCliResponse (legacy)
  const body =
    findFirst(parsed, 'LoginWSService___LoginCli2Response') ??
    findFirst(parsed, 'LoginWSService___LoginCliResponse')
  if (!body) {
    throw makeError('Login response malformed: missing LoginCli2Response/LoginCliResponse', xml)
  }
  const result = pick(body, 'Result')
  if (result !== 'true') {
    const errCode = pick(body, 'strError')
    throw makeError(`TIPSA login failed (strError=${errCode})`, xml)
  }
  const sessionId = pick(body, 'strSesion')
  if (!sessionId) {
    throw makeError('Login response missing strSesion', xml)
  }
  return {
    sessionId,
    clientName: pick(body, 'strNom') ?? '',
    version: pick(body, 'strVersion') ?? '',
    trackingBaseUrl: pick(body, 'strURLDetSegEnv') ?? null,
  }
}

// =========================================================
// GRABA ENVIO 24
// =========================================================

export interface GrabaEnvio24Input {
  creds: { agencyCode: string; clientCode: string }
  sessionId: string
  sender: TipsaSender
  input: TipsaCreateShipmentInput
}

export function buildGrabaEnvio24Envelope({
  creds,
  sessionId,
  sender,
  input,
}: GrabaEnvio24Input): string {
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  const rcp = input.recipient
  // Prefijamos el CP a la poblacion destino para que TIPSA lo imprima siempre
  // en la linea del destinatario (sin esto, el renderer omite el CP del bloque DES).
  // El strCPDes sigue enviandose por separado para routing.
  const pobDesWithCp = rcp.cp ? `${rcp.cp} ${rcp.city}` : rcp.city
  const boRetorno = input.returnShipment ? 'true' : 'false'
  const boSabado = input.saturdayDelivery ? 'true' : 'false'

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header>
    <tem:ROClientIDHeader>
      <tem:ID>${xmlEscape(sessionId)}</tem:ID>
    </tem:ROClientIDHeader>
  </soapenv:Header>
  <soapenv:Body>
    <tem:WebServService___GrabaEnvio24>
      <tem:strCodAgeCargo>${xmlEscape(creds.agencyCode)}</tem:strCodAgeCargo>
      <tem:strCodAgeOri>${xmlEscape(creds.agencyCode)}</tem:strCodAgeOri>
      <tem:dtFecha>${xmlEscape(date)}</tem:dtFecha>
      <tem:strCodTipoServ>${xmlEscape(input.serviceCode)}</tem:strCodTipoServ>
      <tem:strCodCli>${xmlEscape(creds.clientCode)}</tem:strCodCli>
      <tem:strNomOri>${xmlEscape(sender.name)}</tem:strNomOri>
      <tem:strDirOri>${xmlEscape(sender.address)}</tem:strDirOri>
      <tem:strPobOri>${xmlEscape(sender.city)}</tem:strPobOri>
      <tem:strCPOri>${xmlEscape(sender.cp)}</tem:strCPOri>
      <tem:strTlfOri>${xmlEscape(sender.phone)}</tem:strTlfOri>
      <tem:strNomDes>${xmlEscape(rcp.name)}</tem:strNomDes>
      <tem:strDirDes>${xmlEscape(rcp.address)}</tem:strDirDes>
      <tem:strPobDes>${xmlEscape(pobDesWithCp)}</tem:strPobDes>
      <tem:strCPDes>${xmlEscape(rcp.cp)}</tem:strCPDes>
      <tem:strCodPais>${xmlEscape(rcp.country ?? 'ES')}</tem:strCodPais>
      <tem:strTlfDes>${xmlEscape(rcp.phone ?? '')}</tem:strTlfDes>
      <tem:intPaq>${xmlEscape(input.packages)}</tem:intPaq>
      <tem:dPesoOri>${xmlEscape(input.weightKg)}</tem:dPesoOri>
      <tem:boSabado>${boSabado}</tem:boSabado>
      <tem:boRetorno>${boRetorno}</tem:boRetorno>
      <tem:strRef>${xmlEscape(input.reference ?? '')}</tem:strRef>
      <tem:strObs>${xmlEscape(input.observations ?? '')}</tem:strObs>
      <tem:strContenido>${xmlEscape(input.content ?? '')}</tem:strContenido>
      <tem:strPersContacto>${xmlEscape(rcp.contactPerson ?? '')}</tem:strPersContacto>
      <tem:boDesSMS>false</tem:boDesSMS>
      <tem:boDesEmail>${rcp.email ? 'true' : 'false'}</tem:boDesEmail>
      <tem:strDesMoviles>${xmlEscape(rcp.phone ?? '')}</tem:strDesMoviles>
      <tem:strDesDirEmails>${xmlEscape(rcp.email ?? '')}</tem:strDesDirEmails>
      <tem:boInsert>true</tem:boInsert>
    </tem:WebServService___GrabaEnvio24>
  </soapenv:Body>
</soapenv:Envelope>`
}

export function parseGrabaEnvioResponse(xml: string): TipsaCreateShipmentResult {
  const parsed = SHARED_PARSER.parse(xml)
  const body =
    findFirst(parsed, 'WebServService___GrabaEnvio24Response') ??
    findFirst(parsed, 'WebServService___GrabaEnvio18Response') ??
    findFirst(parsed, 'WebServService___GrabaEnvio16Response')
  if (!body) {
    throw makeError('GrabaEnvio response malformed: missing *Response node', xml)
  }
  const albaran = pick(body, 'strAlbaranOut')
  const guid = pick(body, 'strGuidOut') ?? ''
  if (!albaran) {
    throw makeError('GrabaEnvio response missing strAlbaranOut', xml)
  }
  return {
    albaran,
    guid,
    deliveryDate: pick(body, 'dtFecEntrOut') ?? null,
    packagesCount: Number(pick(body, 'intBultosPosteriorOut') ?? '1'),
    rawResponse: xml,
  }
}

// =========================================================
// CONS ETIQUETA ENVIO 6 (PDF/ZPL)
// =========================================================

export interface ConsEtiquetaInput {
  creds: { agencyCode: string }
  sessionId: string
  albaran: string
  format: TipsaLabelFormat
  reportId?: number
}

export function buildConsEtiquetaEnvelope({
  creds,
  sessionId,
  albaran,
  format,
  reportId = 233,
}: ConsEtiquetaInput): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header>
    <tem:ROClientIDHeader>
      <tem:ID>${xmlEscape(sessionId)}</tem:ID>
    </tem:ROClientIDHeader>
  </soapenv:Header>
  <soapenv:Body>
    <tem:WebServService___ConsEtiquetaEnvio6>
      <tem:strCodAgeOri>${xmlEscape(creds.agencyCode)}</tem:strCodAgeOri>
      <tem:strCodAgeCargo>${xmlEscape(creds.agencyCode)}</tem:strCodAgeCargo>
      <tem:StrAlbaran>${xmlEscape(albaran)}</tem:StrAlbaran>
      <tem:intIdRepDet>${xmlEscape(reportId)}</tem:intIdRepDet>
      <tem:strFormato>${xmlEscape(format)}</tem:strFormato>
    </tem:WebServService___ConsEtiquetaEnvio6>
  </soapenv:Body>
</soapenv:Envelope>`
}

export function parseConsEtiquetaResponse(
  xml: string,
  format: TipsaLabelFormat,
): TipsaLabelResult {
  const parsed = SHARED_PARSER.parse(xml)
  const body = findFirst(parsed, 'WebServService___ConsEtiquetaEnvio6Response')
  if (!body) {
    throw makeError('ConsEtiqueta response malformed', xml)
  }
  // TIPSA devuelve el PDF como base64 en algun nodo tipo strBase64Out/strEtiquetaOut.
  // Buscamos la primera clave que contenga texto largo (base64).
  const base64 = findBase64Payload(body)
  if (!base64) {
    throw makeError('ConsEtiqueta response missing base64 payload', xml)
  }
  return { format, base64, rawResponse: xml }
}

// =========================================================
// CONS ENV ESTADOS (tracking)
// =========================================================

export interface ConsEnvEstadosInput {
  creds: { agencyCode: string }
  sessionId: string
  albaran: string
}

export function buildConsEnvEstadosEnvelope({
  creds,
  sessionId,
  albaran,
}: ConsEnvEstadosInput): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header>
    <tem:ROClientIDHeader>
      <tem:ID>${xmlEscape(sessionId)}</tem:ID>
    </tem:ROClientIDHeader>
  </soapenv:Header>
  <soapenv:Body>
    <tem:WebServService___ConsEnvEstados>
      <tem:strCodAgeCargo>${xmlEscape(creds.agencyCode)}</tem:strCodAgeCargo>
      <tem:strCodAgeOri>${xmlEscape(creds.agencyCode)}</tem:strCodAgeOri>
      <tem:strAlbaran>${xmlEscape(albaran)}</tem:strAlbaran>
    </tem:WebServService___ConsEnvEstados>
  </soapenv:Body>
</soapenv:Envelope>`
}

export function parseConsEnvEstadosResponse(xml: string, albaran: string): TipsaTrackingResult {
  const parsed = SHARED_PARSER.parse(xml)
  const body = findFirst(parsed, 'WebServService___ConsEnvEstadosResponse')
  if (!body) {
    throw makeError('ConsEnvEstados response malformed', xml)
  }
  const cdata = pick(body, 'strEnvEstados') ?? ''
  const events = parseEnvEstadosCdata(cdata)
  return { albaran, events, rawResponse: xml }
}

/**
 * El CDATA devuelve XML tipo:
 *   <CONSULTA><ENV_ESTADOS I_ID="1" V_COD_TIPO_EST="1" D_FEC_HORA_ALTA="02/06/2020 17:28:02" .../>...</CONSULTA>
 * Exportado para poder testearlo directo con fixtures.
 */
export function parseEnvEstadosCdata(cdata: string): TipsaShippingEvent[] {
  if (!cdata.trim()) return []
  const parsed = SHARED_PARSER.parse(cdata)
  const consulta = (parsed as Record<string, unknown>).CONSULTA
  if (!consulta || typeof consulta !== 'object') return []
  const nodes = (consulta as Record<string, unknown>).ENV_ESTADOS
  const arr = Array.isArray(nodes) ? nodes : nodes ? [nodes] : []
  return arr
    .map((raw) => {
      const attrs = extractAttrs(raw as Record<string, unknown>)
      const code = attrs['V_COD_TIPO_EST'] ?? ''
      const dateStr = attrs['D_FEC_HORA_ALTA'] ?? ''
      return {
        code,
        label: tipsaEventLabel(code),
        date: parseTipsaDate(dateStr),
        rawAttributes: attrs,
      }
    })
    .filter((e) => e.code.length > 0)
}

/**
 * Fecha TIPSA "MM/DD/YYYY HH:MM:SS" -> ISO UTC.
 *
 * IMPORTANTE: TIPSA envia las fechas en formato AMERICANO (MM/DD/YYYY)
 * a pesar de ser un servicio espanol. Esto esta confirmado en los
 * fixtures oficiales (ej. ConsEnvEstados_code4_response.txt:
 *   D_FEC_HORA_ALTA="11/28/2019 17:50:44"
 * El "28" solo puede ser dia, asi que el orden es MM/DD).
 *
 * No usamos zona horaria precisa: al no tener tzdata en runtime, guardamos
 * como naive local converted a UTC. En la practica TIPSA devuelve hora
 * local del servicio; la diferencia <=2h es aceptable para el timeline.
 */
export function parseTipsaDate(raw: string): string {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return new Date().toISOString()
  const [, mm, dd, yyyy, hh, mi, ss] = m
  // Tratamos como UTC para no depender de locale; acepta +/-2h vs local Spain.
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`).toISOString()
}

// =========================================================
// Helpers
// =========================================================

function findFirst(root: unknown, tagName: string): Record<string, unknown> | null {
  if (!root || typeof root !== 'object') return null
  const stack: unknown[] = [root]
  while (stack.length > 0) {
    const cur = stack.pop()
    if (!cur || typeof cur !== 'object') continue
    const obj = cur as Record<string, unknown>
    if (tagName in obj) {
      const v = obj[tagName]
      if (v && typeof v === 'object') return v as Record<string, unknown>
    }
    for (const k of Object.keys(obj)) {
      stack.push(obj[k])
    }
  }
  return null
}

function pick(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key]
  if (v === undefined || v === null) return undefined
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  // fast-xml-parser returns {'#text': '...'} for nodes with attributes
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)['#text'])
  }
  return undefined
}

function extractAttrs(node: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(node)) {
    if (!k.startsWith('@_')) continue
    out[k.slice(2)] = typeof v === 'string' ? v : String(v)
  }
  return out
}

function findBase64Payload(body: Record<string, unknown>): string | null {
  // Heuristica: TIPSA usa distintos nombres de campo segun version.
  // Buscamos una cadena larga de base64 en cualquier tag hijo.
  for (const v of Object.values(body)) {
    if (typeof v === 'string') {
      const trimmed = v.trim()
      if (trimmed.length > 200 && /^[A-Za-z0-9+/=\r\n\s]+$/.test(trimmed)) {
        return trimmed.replace(/\s+/g, '')
      }
    }
    if (v && typeof v === 'object') {
      const nested = findBase64Payload(v as Record<string, unknown>)
      if (nested) return nested
    }
  }
  return null
}

function makeError(message: string, rawResponse: string, httpStatus?: number): Error {
  const err = new Error(message) as Error & { rawResponse: string; httpStatus?: number }
  err.rawResponse = rawResponse
  if (httpStatus !== undefined) err.httpStatus = httpStatus
  return err
}
