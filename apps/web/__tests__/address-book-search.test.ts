// =============================================================
// Tests: helpers de busqueda en address_book.
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  buildAddressBookFilter,
  buildMultiFieldOr,
} from '@/lib/address-book/query'

describe('buildAddressBookFilter', () => {
  it('input vacio -> mode all', () => {
    expect(buildAddressBookFilter('')).toEqual({ mode: 'all', value: '' })
    expect(buildAddressBookFilter('   ')).toEqual({ mode: 'all', value: '' })
    expect(buildAddressBookFilter(null)).toEqual({ mode: 'all', value: '' })
    expect(buildAddressBookFilter(undefined)).toEqual({ mode: 'all', value: '' })
  })

  it('5 digitos -> mode cp', () => {
    expect(buildAddressBookFilter('28013')).toEqual({ mode: 'cp', value: '28013' })
    expect(buildAddressBookFilter(' 35001 ')).toEqual({ mode: 'cp', value: '35001' })
  })

  it('4 o 6 digitos -> mode multi (no es CP)', () => {
    expect(buildAddressBookFilter('2801')).toEqual({ mode: 'multi', value: '2801' })
    expect(buildAddressBookFilter('280131')).toEqual({ mode: 'multi', value: '280131' })
  })

  it('texto libre -> mode multi', () => {
    expect(buildAddressBookFilter('Bar Manolo')).toEqual({
      mode: 'multi',
      value: 'Bar Manolo',
    })
    expect(buildAddressBookFilter('  Calle Mayor  ')).toEqual({
      mode: 'multi',
      value: 'Calle Mayor',
    })
  })

  it('mezcla letras+digitos -> mode multi', () => {
    expect(buildAddressBookFilter('local-3 28013')).toEqual({
      mode: 'multi',
      value: 'local-3 28013',
    })
  })
})

describe('buildMultiFieldOr', () => {
  it('genera fragmento ilike multi-campo', () => {
    const out = buildMultiFieldOr('manolo')
    expect(out).toContain('name.ilike.%manolo%')
    expect(out).toContain('venue_name.ilike.%manolo%')
    expect(out).toContain('alias.ilike.%manolo%')
    expect(out).toContain('address.ilike.%manolo%')
    expect(out).toContain('contact_person.ilike.%manolo%')
    expect(out).toContain('city.ilike.%manolo%')
  })

  it('escapa caracteres peligrosos para PostgREST', () => {
    const out = buildMultiFieldOr('a,b(c)"d%e')
    // Sin comas (excepto las del separador), parentesis, comillas ni %.
    // Coma: solo aparece como separador entre clausulas (5 separadores entre 6 campos).
    expect((out.match(/,/g) ?? []).length).toBe(5)
    expect(out).not.toContain('(')
    expect(out).not.toContain(')')
    expect(out).not.toContain('"')
    // Solo dos % por fragmento (delimitadores ilike), no del input.
    const expectedPctCount = 6 * 2
    expect((out.match(/%/g) ?? []).length).toBe(expectedPctCount)
  })

  it('input vacio devuelve string vacio', () => {
    expect(buildMultiFieldOr('')).toBe('')
    expect(buildMultiFieldOr('   ')).toBe('')
  })
})
