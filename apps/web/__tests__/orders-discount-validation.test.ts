// =============================================================
// Tests: validateLineDiscount (helper puro)
// =============================================================

import { describe, it, expect } from 'vitest'
import { validateLineDiscount } from '@/lib/orders-validation'

describe('validateLineDiscount', () => {
  it('acepta 0 con cualquier categoria', () => {
    expect(validateLineDiscount(0, 'tpv').ok).toBe(true)
    expect(validateLineDiscount(0, 'pack').ok).toBe(true)
    expect(validateLineDiscount(0, 'printer').ok).toBe(true)
    expect(validateLineDiscount(0, 'network').ok).toBe(true)
  })

  it('acepta 10 con cualquier categoria', () => {
    expect(validateLineDiscount(10, 'tpv').ok).toBe(true)
    expect(validateLineDiscount(10, 'kds').ok).toBe(true)
    expect(validateLineDiscount(10, 'printer').ok).toBe(true)
  })

  it('acepta 100 SOLO con categoria printer', () => {
    expect(validateLineDiscount(100, 'printer').ok).toBe(true)
  })

  it('rechaza 100 con categoria distinta de printer', () => {
    const r = validateLineDiscount(100, 'tpv')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/printer/i)
    }
  })

  it('rechaza valores fuera del set permitido', () => {
    expect(validateLineDiscount(5, 'printer').ok).toBe(false)
    expect(validateLineDiscount(15, 'printer').ok).toBe(false)
    expect(validateLineDiscount(50, 'printer').ok).toBe(false)
    expect(validateLineDiscount(-10, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(101, 'printer').ok).toBe(false)
  })

  it('rechaza tipos invalidos', () => {
    expect(validateLineDiscount('10' as unknown as number, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(NaN, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(null as unknown as number, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(undefined as unknown as number, 'tpv').ok).toBe(false)
  })

  it('rechaza 100 cuando la categoria es null/undefined', () => {
    expect(validateLineDiscount(100, null).ok).toBe(false)
    expect(validateLineDiscount(100, undefined).ok).toBe(false)
  })
})
