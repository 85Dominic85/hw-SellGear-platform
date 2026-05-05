// =============================================================
// Helpers puros para construir filtros de busqueda de address_book.
// =============================================================

const CP_REGEX = /^\d{5}$/

export type AddressBookFilterMode = 'cp' | 'multi' | 'all'

export interface AddressBookFilter {
  mode: AddressBookFilterMode
  /** Termino normalizado (trim, lowercase). Vacio si mode='all'. */
  value: string
}

/**
 * Decide modo de busqueda segun el input del usuario:
 * - 5 digitos numericos -> filtro exacto por `cp`.
 * - vacio o solo espacios -> 'all' (lista completa, paginada).
 * - resto -> 'multi' (ILIKE multi-campo: name, venue_name, alias, address, contact_person).
 *
 * Pure: util para tests y para que la API y el cliente compartan logica.
 */
export function buildAddressBookFilter(raw: string | null | undefined): AddressBookFilter {
  const q = (raw ?? '').trim()
  if (q.length === 0) return { mode: 'all', value: '' }
  if (CP_REGEX.test(q)) return { mode: 'cp', value: q }
  return { mode: 'multi', value: q }
}

/**
 * Construye el argumento `or` para Supabase PostgREST.
 * Ej: "name.ilike.%bar%,venue_name.ilike.%bar%,..."
 *
 * El caller debe escapar % si quiere literal; aqui asumimos input
 * del usuario "limpio" (no se permiten comodines explicitos).
 */
export function buildMultiFieldOr(value: string): string {
  // Escapar caracteres que rompen el parser de PostgREST: , ( ) "
  const safe = value.replace(/[,()"%]/g, ' ').trim()
  if (!safe) return ''
  const fragment = `%${safe}%`
  return [
    `name.ilike.${fragment}`,
    `venue_name.ilike.${fragment}`,
    `alias.ilike.${fragment}`,
    `address.ilike.${fragment}`,
    `contact_person.ilike.${fragment}`,
    `city.ilike.${fragment}`,
  ].join(',')
}
