// =============================================================
// Parseo de query params de los endpoints /api/external/*.
//
// Estos tres helpers vivían privados dentro de
// app/api/external/hwtoolbox/orders/route.ts. Al añadir el listado de envíos
// harían falta otra vez, y un `limit` que se clampe distinto en dos endpoints
// del mismo contrato es el tipo de divergencia que nadie mira hasta que
// alguien pagina mal.
//
// Módulo puro: sin next/server, testeable sin construir una Request.
// =============================================================

/** Tamaño de página por defecto de los listados externos. */
export const DEFAULT_LIMIT = 25
/** Techo de página. Protege la BD de un `limit=100000`. */
export const MAX_LIMIT = 50
/** Techo de `offset`. Más allá no hay nada que paginar. */
export const MAX_OFFSET = 100_000

export function clampInt(
  raw: string | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

/** `YYYY-MM-DD` y además una fecha que existe. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const t = Date.parse(value)
  return !Number.isNaN(t)
}

/**
 * Día siguiente en `YYYY-MM-DD`.
 * Los filtros `to` son INCLUSIVOS, así que se traducen a `< to + 1 día` para
 * que entre la fecha completa y no solo su medianoche.
 */
export function addOneDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Escapa los comodines de un `ILIKE` para que el texto que llega del cliente
 * se busque literal. Sin esto, un `q` con `%` lista la tabla entera.
 */
export function ilikePattern(q: string): string {
  return `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`
}
