// =============================================================
// Tests: helpers de pricing en centimos.
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  lineSubtotalCents,
  lineDiscountCents,
  lineTaxableCents,
  lineVatCents,
  lineTotalCents,
  cartTotals,
  formatEurosCents,
} from '@/lib/pricing'

describe('lineSubtotalCents', () => {
  it('multiplica precio por cantidad', () => {
    expect(lineSubtotalCents(62700, 2)).toBe(125400)
  })

  it('cantidad 1 devuelve el precio', () => {
    expect(lineSubtotalCents(13640, 1)).toBe(13640)
  })

  it('cero por cero', () => {
    expect(lineSubtotalCents(0, 0)).toBe(0)
  })
})

describe('lineDiscountCents', () => {
  it('descuento 10% de 627€ x 1', () => {
    expect(lineDiscountCents(62700, 1, 10)).toBe(6270)
  })

  it('descuento 0% es cero', () => {
    expect(lineDiscountCents(62700, 2, 0)).toBe(0)
  })
})

describe('lineTaxableCents', () => {
  it('base imponible tras descuento 10%', () => {
    expect(lineTaxableCents(62700, 1, 10)).toBe(56430)
  })
})

describe('lineVatCents', () => {
  it('IVA 21% sobre base con descuento', () => {
    // 627 - 10% = 564.30; *21% = 118.50 (redondeo banker)
    expect(lineVatCents(62700, 1, 10, 21)).toBe(11850)
  })

  it('IVA 0% es cero', () => {
    expect(lineVatCents(62700, 1, 0, 0)).toBe(0)
  })
})

describe('lineTotalCents', () => {
  it('TPV Estandar (627€) sin descuento, IVA 21%', () => {
    // 62700 + 21% = 75867
    expect(lineTotalCents(62700, 1, 0, 21)).toBe(75867)
  })

  it('TPV Estandar con 10% de descuento', () => {
    // base 56430, IVA 11850 → 68280
    expect(lineTotalCents(62700, 1, 10, 21)).toBe(68280)
  })
})

describe('cartTotals', () => {
  it('carrito vacio devuelve ceros', () => {
    expect(cartTotals([])).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      taxableCents: 0,
      vatCents: 0,
      totalCents: 0,
    })
  })

  it('una linea sin descuento', () => {
    const t = cartTotals([{ priceCents: 62700, qty: 1, discountPct: 0, vatRate: 21 }])
    expect(t.subtotalCents).toBe(62700)
    expect(t.discountCents).toBe(0)
    expect(t.taxableCents).toBe(62700)
    expect(t.vatCents).toBe(13167)
    expect(t.totalCents).toBe(75867)
  })

  it('dos lineas: TPV con 10% + Impresora WiFi sin descuento', () => {
    const t = cartTotals([
      { priceCents: 62700, qty: 1, discountPct: 10, vatRate: 21 },
      { priceCents: 13640, qty: 1, discountPct: 0, vatRate: 21 },
    ])
    expect(t.subtotalCents).toBe(76340)
    expect(t.discountCents).toBe(6270)
    expect(t.taxableCents).toBe(70070)
    // 56430 * 0.21 = 11850.3 → 11850; 13640 * 0.21 = 2864.4 → 2864
    expect(t.vatCents).toBe(11850 + 2864)
    expect(t.totalCents).toBe(70070 + 11850 + 2864)
  })

  it('cantidad multiple', () => {
    const t = cartTotals([{ priceCents: 4290, qty: 3, discountPct: 0, vatRate: 21 }])
    expect(t.subtotalCents).toBe(12870)
    expect(t.totalCents).toBe(12870 + 2703)
  })
})

describe('formatEurosCents', () => {
  it('formatea con simbolo euro', () => {
    expect(formatEurosCents(75867)).toMatch(/758,67/)
    expect(formatEurosCents(75867)).toMatch(/€/)
  })

  it('cero', () => {
    expect(formatEurosCents(0)).toMatch(/0,00/)
  })
})
