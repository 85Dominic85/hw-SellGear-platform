// =============================================================
// Tests: helpers taxType / taxLabel / effectiveTaxLabel
// =============================================================

import { describe, it, expect } from 'vitest'
import { taxType, taxLabel, effectiveTaxLabel } from '@/lib/pricing'

describe('taxType', () => {
  it('21 → iva', () => expect(taxType(21)).toBe('iva'))
  it('7 → igic', () => expect(taxType(7)).toBe('igic'))
  it('0 → none', () => expect(taxType(0)).toBe('none'))
  it('10 → iva (cualquier rate distinto de 0/7)', () =>
    expect(taxType(10)).toBe('iva'))
})

describe('taxLabel', () => {
  it('21 → "IVA 21 %"', () => expect(taxLabel(21)).toBe('IVA 21 %'))
  it('7 → "IGIC 7 %" (pedidos legacy 12-may a 20-may-2026)', () =>
    expect(taxLabel(7)).toBe('IGIC 7 %'))
  it('0 → "Exento (Canarias)" (politica desde 21-may-2026)', () =>
    expect(taxLabel(0)).toBe('Exento (Canarias)'))
})

describe('effectiveTaxLabel', () => {
  it('todas 21 → "IVA 21 %"', () =>
    expect(effectiveTaxLabel([21, 21, 21])).toBe('IVA 21 %'))

  it('todas 7 → "IGIC 7 %"', () =>
    expect(effectiveTaxLabel([7, 7])).toBe('IGIC 7 %'))

  it('mezcla 21+7 → "Impuestos (mixto)"', () =>
    expect(effectiveTaxLabel([21, 7])).toBe('Impuestos (mixto)'))

  it('mezcla iva+sin impuesto → "Impuestos (mixto)"', () =>
    expect(effectiveTaxLabel([21, 0])).toBe('Impuestos (mixto)'))

  it('lista vacia → ""', () =>
    expect(effectiveTaxLabel([])).toBe(''))

  it('una sola tasa con duplicados → etiqueta de esa tasa', () =>
    expect(effectiveTaxLabel([7])).toBe('IGIC 7 %'))
})
