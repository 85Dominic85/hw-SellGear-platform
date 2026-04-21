/**
 * Cliente SOAP TIPSA minimal.
 * - Sesion cacheada en memoria con TTL 25 min (TIPSA expira cerca de 30).
 * - Reintento automatico 1 vez tras relogin si la sesion ha caducado.
 * - Sin deps externas: fetch + fast-xml-parser (via envelopes.ts).
 */

import {
  buildConsEnvEstadosEnvelope,
  buildConsEtiquetaEnvelope,
  buildGrabaEnvio24Envelope,
  buildLoginEnvelope,
  parseConsEnvEstadosResponse,
  parseConsEtiquetaResponse,
  parseGrabaEnvioResponse,
  parseLoginResponse,
} from './envelopes'
import { TIPSA_URLS } from './services'
import type {
  TipsaConfig,
  TipsaCreateShipmentInput,
  TipsaCreateShipmentResult,
  TipsaLabelFormat,
  TipsaLabelResult,
  TipsaLoginResult,
  TipsaSession,
  TipsaTrackingResult,
} from './types'

const SESSION_TTL_MS = 25 * 60 * 1000

// Cache en memoria por (env + agency + client) para permitir multi-env en el mismo proceso.
const sessionCache = new Map<string, TipsaSession>()

function cacheKey(config: TipsaConfig): string {
  return `${config.env}:${config.credentials.agencyCode}:${config.credentials.clientCode}`
}

function isSessionFresh(session: TipsaSession): boolean {
  return Date.now() - session.createdAt < SESSION_TTL_MS
}

/**
 * Abre (o reutiliza) sesion TIPSA.
 */
export async function login(config: TipsaConfig): Promise<TipsaLoginResult> {
  const key = cacheKey(config)
  const cached = sessionCache.get(key)
  if (cached && isSessionFresh(cached)) {
    return {
      sessionId: cached.id,
      clientName: '',
      version: '',
      trackingBaseUrl: cached.trackingBaseUrl,
    }
  }

  const body = buildLoginEnvelope(config.credentials)
  const xml = await postSoap(TIPSA_URLS[config.env].login, body, 'urn:DinaPaq-LoginWSService#LoginCli2')
  const parsed = parseLoginResponse(xml)
  sessionCache.set(key, {
    id: parsed.sessionId,
    createdAt: Date.now(),
    trackingBaseUrl: parsed.trackingBaseUrl,
  })
  return parsed
}

function invalidateSession(config: TipsaConfig): void {
  sessionCache.delete(cacheKey(config))
}

async function withSession<T>(
  config: TipsaConfig,
  action: (session: TipsaSession) => Promise<T>,
): Promise<T> {
  const key = cacheKey(config)
  let session = sessionCache.get(key)
  if (!session || !isSessionFresh(session)) {
    await login(config)
    session = sessionCache.get(key)!
  }
  try {
    return await action(session)
  } catch (err) {
    // Si falla, intentamos relogin una vez (sesion puede haber caducado antes de TTL).
    if (isSessionError(err)) {
      invalidateSession(config)
      await login(config)
      const fresh = sessionCache.get(key)!
      return action(fresh)
    }
    throw err
  }
}

function isSessionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const raw = (err as Error & { rawResponse?: string }).rawResponse ?? ''
  return /sesion|session|no.*valid|expired/i.test(raw) ||
    /sesion|session|no.*valid|expired/i.test(err.message)
}

/**
 * Crea envio en TIPSA (GrabaEnvio24).
 */
export async function createShipment(
  config: TipsaConfig,
  input: TipsaCreateShipmentInput,
): Promise<TipsaCreateShipmentResult> {
  return withSession(config, async (session) => {
    const body = buildGrabaEnvio24Envelope({
      creds: config.credentials,
      sessionId: session.id,
      sender: config.sender,
      input,
    })
    const xml = await postSoap(TIPSA_URLS[config.env].webserv, body, 'urn:DinaPaq-WebServService#GrabaEnvio24')
    return parseGrabaEnvioResponse(xml)
  })
}

/**
 * Descarga etiqueta de envio.
 */
export async function fetchLabel(
  config: TipsaConfig,
  albaran: string,
  format: TipsaLabelFormat = 'pdf',
): Promise<TipsaLabelResult> {
  return withSession(config, async (session) => {
    const body = buildConsEtiquetaEnvelope({
      creds: config.credentials,
      sessionId: session.id,
      albaran,
      format,
    })
    const xml = await postSoap(TIPSA_URLS[config.env].webserv, body, 'urn:DinaPaq-WebServService#ConsEtiquetaEnvio6')
    return parseConsEtiquetaResponse(xml, format)
  })
}

/**
 * Consulta estados de un envio.
 */
export async function fetchTracking(
  config: TipsaConfig,
  albaran: string,
): Promise<TipsaTrackingResult> {
  return withSession(config, async (session) => {
    const body = buildConsEnvEstadosEnvelope({
      creds: config.credentials,
      sessionId: session.id,
      albaran,
    })
    const xml = await postSoap(TIPSA_URLS[config.env].webserv, body, 'urn:DinaPaq-WebServService#ConsEnvEstados')
    return parseConsEnvEstadosResponse(xml, albaran)
  })
}

// =========================================================
// HTTP POST SOAP
// =========================================================

async function postSoap(url: string, body: string, soapAction: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${soapAction}"`,
      'User-Agent': 'qamarero-tipsa-client/1.0',
      Accept: '*/*',
    },
    body,
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(
      `TIPSA HTTP ${res.status} ${res.statusText} on ${soapAction}`,
    ) as Error & { httpStatus: number; rawResponse: string }
    err.httpStatus = res.status
    err.rawResponse = text
    throw err
  }
  // Detectar SOAP Fault ([\w-]+ para cubrir prefijos con guion como SOAP-ENV)
  if (/<([\w-]+:)?Fault[>\s]/.test(text)) {
    const reason = extractFaultReason(text)
    const err = new Error(
      `TIPSA SOAP Fault on ${soapAction}${reason ? `: ${reason}` : ''}`,
    ) as Error & { rawResponse: string }
    err.rawResponse = text
    throw err
  }
  return text
}

/**
 * Extrae el texto humano del SOAP Fault. TIPSA usa faultstring o faultcode.
 */
function extractFaultReason(xml: string): string {
  const faultstring = xml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i)?.[1]
  if (faultstring) return decodeEntities(faultstring.trim())
  const faultcode = xml.match(/<faultcode[^>]*>([\s\S]*?)<\/faultcode>/i)?.[1]
  if (faultcode) return decodeEntities(faultcode.trim())
  const reason = xml.match(/<(?:[\w-]+:)?Reason[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Reason>/i)?.[1]
  if (reason) return decodeEntities(reason.trim())
  return ''
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}
