// =============================================================
// Puente /catalogo -> /orders/new.
//
// La selección viaja en la URL (`?sel=pack-pro:1,printer-wifi:2`): es
// compartible, sobrevive a un refresh, se puede leer en servidor y se
// depura a ojo. Se descartaron sessionStorage como handoff (invisible y se
// queda rancio), un context compartido (son árboles de rutas distintos) y
// una tabla de borradores (sobre-ingeniería para un flujo de 30 segundos).
//
// TODO LO QUE ENTRA POR AQUÍ ES HOSTIL. El parser no lanza nunca: ante
// cualquier basura devuelve []. Y el servidor revalida igualmente: estos
// `code` solo preseleccionan líneas en un formulario.
// =============================================================

export interface CatalogPick {
  code: string
  qty: number
}

export const SELECTION_PARAM = 'sel'
/** Tope de líneas. Un pedido real no tiene 40 referencias distintas. */
export const MAX_PICKS = 40
export const MAX_QTY = 99

/** Los `code` del catálogo son slugs: minúsculas, dígitos, guiones y `_`. */
const CODE_RE = /^[a-z0-9_-]{1,64}$/

export function encodeCatalogPicks(picks: CatalogPick[]): string {
  return picks
    .filter((p) => CODE_RE.test(p.code) && p.qty >= 1)
    .slice(0, MAX_PICKS)
    .map((p) => `${p.code}:${Math.min(MAX_QTY, Math.floor(p.qty))}`)
    .join(',')
}

/**
 * Parsea `?sel=`. Deduplica sumando cantidades, descarta lo que no case el
 * patrón de `code`, acota la cantidad a 1..99 y trunca a MAX_PICKS.
 */
export function parseCatalogPicks(raw: string | null | undefined): CatalogPick[] {
  if (!raw) return []
  const byCode = new Map<string, number>()
  for (const chunk of raw.split(',')) {
    const [codeRaw, qtyRaw] = chunk.split(':')
    const code = (codeRaw ?? '').trim().toLowerCase()
    if (!CODE_RE.test(code)) continue
    const parsed = Number.parseInt(qtyRaw ?? '1', 10)
    if (!Number.isFinite(parsed) || parsed < 1) continue
    const qty = Math.min(MAX_QTY, parsed)
    byCode.set(code, Math.min(MAX_QTY, (byCode.get(code) ?? 0) + qty))
    if (byCode.size >= MAX_PICKS) break
  }
  return [...byCode].map(([code, qty]) => ({ code, qty }))
}

/** Href al wizard con la selección precargada. */
export function buildNewOrderHref(picks: CatalogPick[]): string {
  const encoded = encodeCatalogPicks(picks)
  return encoded
    ? `/orders/new?${SELECTION_PARAM}=${encodeURIComponent(encoded)}`
    : '/orders/new'
}
