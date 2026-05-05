// =============================================================
// Validacion de payload para alta/edicion de address_book.
// =============================================================

import type { AddressBookInput } from '@/types/database'

const CP_REGEX = /^\d{5}$/

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function trimOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

function trimOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function validateAddressBookInput(
  body: unknown,
): ValidationResult<AddressBookInput> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body invalido.' }
  }
  const b = body as Record<string, unknown>

  const name = trimOrEmpty(b.name)
  if (!name) return { ok: false, error: 'El campo "name" es obligatorio.' }

  const address = trimOrEmpty(b.address)
  if (!address) return { ok: false, error: 'El campo "address" es obligatorio.' }

  const cp = trimOrEmpty(b.cp)
  if (!CP_REGEX.test(cp)) {
    return { ok: false, error: 'El CP debe tener exactamente 5 digitos.' }
  }

  const city = trimOrEmpty(b.city)
  if (!city) return { ok: false, error: 'El campo "city" es obligatorio.' }

  return {
    ok: true,
    data: {
      name,
      address,
      cp,
      city,
      alias: trimOrNull(b.alias),
      venue_name: trimOrNull(b.venue_name),
      province: trimOrNull(b.province),
      phone: trimOrNull(b.phone),
      email: trimOrNull(b.email),
      contact_person: trimOrNull(b.contact_person),
      notes: trimOrNull(b.notes),
    },
  }
}
