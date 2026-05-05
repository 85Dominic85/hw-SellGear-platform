// =============================================================
// Helper: a~ade una direccion al address_book si no existe ya.
// Usa el UNIQUE natural (name_norm, cp, address_norm) y silencia
// el conflicto, asi nunca rompe el flujo principal del caller.
// =============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

const CP_REGEX = /^\d{5}$/

export interface AddressUpsertInput {
  name: string
  address: string
  cp: string
  city: string
  venue_name?: string | null
  province?: string | null
  phone?: string | null
  email?: string | null
  contact_person?: string | null
  created_by?: string | null
}

/**
 * Inserta una direccion en address_book con upsert idempotente.
 *
 * - Valida campos obligatorios (name, address, cp 5 digitos, city).
 * - Si falta algo, NO inserta y devuelve `{ skipped: true }`.
 * - Si insert falla por duplicado natural, devuelve `{ skipped: true }`.
 * - Si insert falla por otro motivo, lo loggea pero no propaga el error.
 *
 * No lanza nunca: el caller puede usar `await` sin try/catch porque el
 * resultado del flujo principal no debe depender de esto.
 */
export async function upsertAddressFromOrder(
  admin: SupabaseClient,
  input: AddressUpsertInput,
): Promise<{ inserted: boolean; skipped?: boolean; reason?: string }> {
  const name = input.name?.trim() ?? ''
  const address = input.address?.trim() ?? ''
  const cp = input.cp?.trim() ?? ''
  const city = input.city?.trim() ?? ''

  if (!name || !address || !city || !CP_REGEX.test(cp)) {
    return { inserted: false, skipped: true, reason: 'invalid_input' }
  }

  const trimOrNull = (v: string | null | undefined): string | null => {
    if (typeof v !== 'string') return null
    const t = v.trim()
    return t.length === 0 ? null : t
  }

  const payload = {
    name,
    address,
    cp,
    city,
    venue_name: trimOrNull(input.venue_name),
    province: trimOrNull(input.province),
    phone: trimOrNull(input.phone),
    email: trimOrNull(input.email),
    contact_person: trimOrNull(input.contact_person),
    created_by: input.created_by ?? null,
  }

  // Insert con ignoreDuplicates apunta al UNIQUE natural definido en
  // 20260505000003_address_book_dedupe_and_backfill.sql.
  const { error } = await admin
    .from('address_book')
    .upsert(payload, {
      onConflict: 'name_norm,cp,address_norm',
      ignoreDuplicates: true,
    })

  if (error) {
    // 23505 = duplicate key. No es problema: la entrada ya existia.
    if (error.code === '23505') {
      return { inserted: false, skipped: true, reason: 'duplicate' }
    }
    // Otro error: log y silencio. NO debe romper el flujo principal.
    console.warn('[address-book/upsert] non-fatal error:', error.message)
    return { inserted: false, skipped: true, reason: error.message }
  }

  return { inserted: true }
}
