/**
 * Parseo minimo de un string libre de direccion espanola hacia los campos
 * que TIPSA espera en GrabaEnvio24: calle + CP + poblacion.
 *
 * Acepta formatos habituales:
 *   "Calle Betis 12, 41010 Sevilla"
 *   "Av. Reina Mercedes 50, 3B, 41012 Sevilla"
 *   "Rua Irmans Moreno 14 bajo 32600 Verin Ourense"
 *   "Carrer de Sant Antoni, 49, 08221 Terrassa, Barcelona (El Petit Cafe)"
 *
 * Devuelve ParsedAddress con cp vacio si no encuentra un CP de 5 digitos.
 */
export interface ParsedAddress {
  street: string
  city: string
  cp: string
}

export function parseShippingAddress(raw: string): ParsedAddress {
  const cpMatch = raw.match(/\b(\d{5})\b/)
  if (!cpMatch) return { street: raw, city: '', cp: '' }
  const cp = cpMatch[1]
  const idx = cpMatch.index ?? 0
  const before = raw.slice(0, idx).replace(/[,\s]+$/, '').trim()
  const afterRaw = raw.slice(idx + 5).replace(/^[,\s]+/, '').trim()
  // Poblacion: solo hasta la primera coma o parentesis (la provincia y notas se descartan).
  // Ej: "Terrassa, Barcelona (El Petit Cafe)" -> "Terrassa"
  const cityMatch = afterRaw.match(/^([^,(]+?)(?:\s*[,(]|$)/)
  const city = (cityMatch ? cityMatch[1] : afterRaw).trim()
  return {
    street: before || raw,
    city,
    cp,
  }
}
