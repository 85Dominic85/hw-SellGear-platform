// =============================================================================
// Helpers puros TIPSA para Deno (Edge Functions).
// Espejo funcional de apps/web/lib/tipsa/services.ts pero SIN dependencias
// (Deno no puede hacer import de apps/web). Mantener sincronizado a mano si
// alguna vez cambian estos helpers en el lado Node.
// =============================================================================

export type TipsaEventCode = string

export const TIPSA_EVENT_LABELS: Record<string, string> = {
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

export function tipsaEventLabel(code: TipsaEventCode): string {
  return TIPSA_EVENT_LABELS[code] ?? `Estado ${code}`
}

/** Codigos "finales" que indican que el envio ha llegado a su ultimo destino. */
export const TIPSA_TERMINAL_CODES = new Set<string>(['2', '6'])

export function isTerminalEvent(code: TipsaEventCode): boolean {
  return TIPSA_TERMINAL_CODES.has(code)
}

/** Codigo "anotacion" — 3 post-entrega no cambia el estado oficial. */
const NOTE_CODE = '3'

/**
 * Estado oficial ignorando anotaciones post-entrega (codigo 3 tras codigo 2).
 * Asume events ordenados cronologicamente ASCENDENTE.
 * Generico via getCode para servir a distintas formas de fila.
 */
export function resolveOfficialStatus<T>(
  events: T[],
  getCode: (e: T) => string,
): T | null {
  if (events.length === 0) return null
  for (let i = events.length - 1; i >= 0; i--) {
    if (getCode(events[i]) !== NOTE_CODE) return events[i]
  }
  return events[events.length - 1]
}

/**
 * Fecha TIPSA "MM/DD/YYYY HH:MM:SS" -> ISO UTC.
 * TIPSA emite MM/DD (US) en hora local Madrid (sin sufijo TZ).
 * DST se resuelve via Intl.DateTimeFormat con timeZone 'Europe/Madrid'.
 */
export function parseTipsaDate(raw: string): string {
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
 * Formato inverso: ISO UTC -> "YYYY/MM/DD HH:MM:SS" (hora local Madrid).
 * Este es el formato que espera el REQUEST de ConsEnvEstIncCambiosEstados.
 */
export function formatTipsaRequestDate(isoUtc: string): string {
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
