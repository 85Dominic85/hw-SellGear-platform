// =============================================================
// Tests: validateLineDiscount + validateGlobalDiscount (helpers puros)
//
// El modelo pasa de un set fijo {0, 10, 100} a un rango libre 0-100
// (entero). saas_hardware sigue bloqueado a 0.
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  validateLineDiscount,
  validateGlobalDiscount,
} from '@/lib/orders-validation'

describe('validateLineDiscount', () => {
  it('acepta 0 con cualquier categoria', () => {
    expect(validateLineDiscount(0, 'tpv').ok).toBe(true)
    expect(validateLineDiscount(0, 'pack').ok).toBe(true)
    expect(validateLineDiscount(0, 'printer').ok).toBe(true)
    expect(validateLineDiscount(0, 'network').ok).toBe(true)
  })

  it('acepta cualquier entero 1-99 en cualquier categoria excepto saas_hardware', () => {
    expect(validateLineDiscount(5, 'tpv').ok).toBe(true)
    expect(validateLineDiscount(12, 'kds').ok).toBe(true)
    expect(validateLineDiscount(25, 'pack').ok).toBe(true)
    expect(validateLineDiscount(50, 'accessory').ok).toBe(true)
    expect(validateLineDiscount(75, 'network').ok).toBe(true)
    expect(validateLineDiscount(99, 'printer').ok).toBe(true)
  })

  it('acepta 100 con cualquier categoria excepto saas_hardware', () => {
    // Con el rango libre ya no hay regla especial "solo printer" para 100%.
    expect(validateLineDiscount(100, 'printer').ok).toBe(true)
    expect(validateLineDiscount(100, 'tpv').ok).toBe(true)
    expect(validateLineDiscount(100, 'pack').ok).toBe(true)
    expect(validateLineDiscount(100, null).ok).toBe(true)
  })

  it('rechaza fuera de rango (negativo o >100)', () => {
    expect(validateLineDiscount(-1, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(-10, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(101, 'printer').ok).toBe(false)
    expect(validateLineDiscount(200, 'kds').ok).toBe(false)
  })

  it('rechaza decimales (solo enteros)', () => {
    expect(validateLineDiscount(10.5, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(12.34, 'pack').ok).toBe(false)
    expect(validateLineDiscount(0.1, 'printer').ok).toBe(false)
  })

  it('rechaza tipos invalidos', () => {
    expect(validateLineDiscount('10' as unknown as number, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(NaN, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(Infinity, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(null as unknown as number, 'tpv').ok).toBe(false)
    expect(validateLineDiscount(undefined as unknown as number, 'tpv').ok).toBe(false)
  })

  it('saas_hardware fuerza descuento 0', () => {
    const ok = validateLineDiscount(0, 'saas_hardware')
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.pct).toBe(0)
  })

  it('rechaza cualquier descuento != 0 con saas_hardware', () => {
    const r10 = validateLineDiscount(10, 'saas_hardware')
    expect(r10.ok).toBe(false)
    if (!r10.ok) expect(r10.error).toMatch(/saas \+ hardware/i)

    expect(validateLineDiscount(25, 'saas_hardware').ok).toBe(false)
    expect(validateLineDiscount(100, 'saas_hardware').ok).toBe(false)
  })

  it('acepta 100 cuando la categoria es null/undefined', () => {
    // Con el rango libre, la regla "100 solo printer" desaparece; sin
    // categoría también se permite.
    expect(validateLineDiscount(100, null).ok).toBe(true)
    expect(validateLineDiscount(100, undefined).ok).toBe(true)
  })
})

describe('validateGlobalDiscount', () => {
  it('acepta enteros 0-100', () => {
    expect(validateGlobalDiscount(0).ok).toBe(true)
    expect(validateGlobalDiscount(1).ok).toBe(true)
    expect(validateGlobalDiscount(15).ok).toBe(true)
    expect(validateGlobalDiscount(50).ok).toBe(true)
    expect(validateGlobalDiscount(100).ok).toBe(true)
  })

  it('rechaza fuera de rango', () => {
    expect(validateGlobalDiscount(-1).ok).toBe(false)
    expect(validateGlobalDiscount(101).ok).toBe(false)
    expect(validateGlobalDiscount(1000).ok).toBe(false)
  })

  it('rechaza decimales y no-números', () => {
    expect(validateGlobalDiscount(12.5).ok).toBe(false)
    expect(validateGlobalDiscount(NaN).ok).toBe(false)
    expect(validateGlobalDiscount('10' as unknown as number).ok).toBe(false)
    expect(validateGlobalDiscount(null as unknown as number).ok).toBe(false)
  })
})
