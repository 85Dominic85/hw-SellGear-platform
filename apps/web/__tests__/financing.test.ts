// =============================================================
// Tests: planes de financiación (lib/financing.ts).
// Verifica importes, sumas y plazos con IVA, incluida la propiedad
// crítica: la suma de los plazos gross coincide con el total que
// calcula cartTotals sobre la línea única (precio = base total).
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  FINANCING_PLANS,
  FINANCEABLE_CODES,
  isFinanceableCode,
  financingPlanBaseCents,
  financingBaseTotalCents,
  financingInstallments,
} from '@/lib/financing'
import { cartTotals } from '@/lib/pricing'

describe('FINANCING_PLANS', () => {
  it('contiene exactamente los 3 productos financiables', () => {
    expect(FINANCEABLE_CODES.sort()).toEqual(
      ['kds-estandar', 'pack-premium', 'pack-pro'].sort(),
    )
  })

  it('importes base coinciden con el catálogo 2026 (céntimos)', () => {
    expect(FINANCING_PLANS['pack-pro']).toEqual([50000, 22500, 22500])
    expect(FINANCING_PLANS['pack-premium']).toEqual([69900, 35000, 35000])
    expect(FINANCING_PLANS['kds-estandar']).toEqual([39000, 19000, 19000])
  })
})

describe('isFinanceableCode', () => {
  it('acepta los 3 financiables y rechaza el resto', () => {
    expect(isFinanceableCode('pack-pro')).toBe(true)
    expect(isFinanceableCode('pack-premium')).toBe(true)
    expect(isFinanceableCode('kds-estandar')).toBe(true)
    expect(isFinanceableCode('pack-esencial')).toBe(false)
    expect(isFinanceableCode('tpv-pro')).toBe(false)
    expect(isFinanceableCode('otro')).toBe(false)
    expect(isFinanceableCode('')).toBe(false)
  })
})

describe('financingBaseTotalCents', () => {
  it('suma las 3 etapas', () => {
    expect(financingBaseTotalCents('pack-pro')).toBe(95000) // 950 €
    expect(financingBaseTotalCents('pack-premium')).toBe(139900) // 1399 €
    expect(financingBaseTotalCents('kds-estandar')).toBe(77000) // 770 €
  })
  it('devuelve null para no financiables', () => {
    expect(financingBaseTotalCents('tpv-estandar')).toBeNull()
    expect(financingPlanBaseCents('cajon')).toBeNull()
  })
})

describe('financingInstallments — IVA 21 % (peninsular)', () => {
  it('Pack Pro: 605 | 272,25 | 272,25', () => {
    const inst = financingInstallments('pack-pro', 21)!
    expect(inst.map((i) => i.grossCents)).toEqual([60500, 27225, 27225])
    expect(inst.map((i) => i.stage)).toEqual([1, 2, 3])
  })

  it('la suma de plazos gross == total de cartTotals sobre la línea única', () => {
    for (const code of FINANCEABLE_CODES) {
      const base = financingBaseTotalCents(code)!
      const inst = financingInstallments(code, 21)!
      const sumGross = inst.reduce((s, i) => s + i.grossCents, 0)
      const totals = cartTotals([
        { priceCents: base, qty: 1, discountPct: 0, vatRate: 21 },
      ])
      expect(sumGross, `code ${code}`).toBe(totals.totalCents)
    }
  })
})

describe('financingInstallments — Canarias (0 %)', () => {
  it('sin IVA, gross == base', () => {
    const inst = financingInstallments('kds-estandar', 0)!
    expect(inst.map((i) => i.grossCents)).toEqual([39000, 19000, 19000])
    expect(inst.every((i) => i.vatCents === 0)).toBe(true)
  })
})

describe('financingInstallments — no financiable', () => {
  it('devuelve null', () => {
    expect(financingInstallments('pack-esencial', 21)).toBeNull()
  })
})
