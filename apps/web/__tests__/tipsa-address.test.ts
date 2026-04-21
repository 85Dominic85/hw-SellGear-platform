import { describe, expect, it } from 'vitest'
import { parseShippingAddress } from '@/lib/tipsa/address'

describe('parseShippingAddress', () => {
  it('parses simple street + CP + city', () => {
    expect(parseShippingAddress('Calle Betis 12, 41010 Sevilla')).toEqual({
      street: 'Calle Betis 12',
      cp: '41010',
      city: 'Sevilla',
    })
  })

  it('strips province and notes from city', () => {
    expect(
      parseShippingAddress('Carrer de Sant Antoni, 49, 08221 Terrassa, Barcelona (El Petit Café)'),
    ).toEqual({
      street: 'Carrer de Sant Antoni, 49',
      cp: '08221',
      city: 'Terrassa',
    })
  })

  it('handles addresses with multiple tokens before CP', () => {
    expect(parseShippingAddress('Rúa Irmans Moreno 14 bajo 32600 Verin Ourense')).toEqual({
      street: 'Rúa Irmans Moreno 14 bajo',
      cp: '32600',
      city: 'Verin Ourense',
    })
  })

  it('handles parenthesized prefix before CP', () => {
    expect(
      parseShippingAddress('Av. del Puerto (loc. 8, 9 y 10) 07610 Cala Millor'),
    ).toEqual({
      street: 'Av. del Puerto (loc. 8, 9 y 10)',
      cp: '07610',
      city: 'Cala Millor',
    })
  })

  it('returns empty cp when address lacks 5-digit CP', () => {
    const parsed = parseShippingAddress('Una direccion sin codigo postal')
    expect(parsed.cp).toBe('')
  })

  it('does not confuse 4-digit or 6-digit numbers with a CP', () => {
    // '1234' (4 dig) y '123456' (6 dig) no deben matchear
    expect(parseShippingAddress('Poligono Industrial 1234 Sevilla').cp).toBe('')
    expect(parseShippingAddress('Ref 123456 Calle Azul Madrid').cp).toBe('')
  })

  it('takes only the FIRST 5-digit number as CP', () => {
    // 07610 y 28036 en la misma cadena -> primero gana
    const parsed = parseShippingAddress('Calle Principal 07610 Cala Millor, ref 28036')
    expect(parsed.cp).toBe('07610')
    expect(parsed.city).toBe('Cala Millor')
  })

  it('trims whitespace and extra commas', () => {
    const parsed = parseShippingAddress('  Calle Sol 5  ,  28013  Madrid  ')
    expect(parsed.street).toBe('Calle Sol 5')
    expect(parsed.cp).toBe('28013')
    expect(parsed.city).toBe('Madrid')
  })

  it('preserves accents and special chars in street/city', () => {
    expect(parseShippingAddress('P.º Alcalde Marqués del Contadero 1, 41001 Sevilla')).toEqual({
      street: 'P.º Alcalde Marqués del Contadero 1',
      cp: '41001',
      city: 'Sevilla',
    })
  })
})
