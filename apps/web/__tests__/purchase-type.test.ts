// =============================================================
// Tests: VALID_PURCHASE_TYPES + isValidPurchaseType
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  VALID_PURCHASE_TYPES,
  isValidPurchaseType,
} from '@/lib/purchase-type'
import type { PurchaseType } from '@/types/database'

describe('VALID_PURCHASE_TYPES', () => {
  it('contiene exactamente los 6 valores del union PurchaseType', () => {
    const expected: PurchaseType[] = [
      'kit_digital',
      'hardware_one_off',
      'hardware_financiacion',
      'transferencias_saas',
      'saas_hardware',
      'otro',
    ]
    expect(VALID_PURCHASE_TYPES.size).toBe(expected.length)
    for (const v of expected) {
      expect(VALID_PURCHASE_TYPES.has(v)).toBe(true)
    }
  })
})

describe('isValidPurchaseType', () => {
  it('acepta los 6 PurchaseType validos', () => {
    expect(isValidPurchaseType('kit_digital')).toBe(true)
    expect(isValidPurchaseType('hardware_one_off')).toBe(true)
    expect(isValidPurchaseType('hardware_financiacion')).toBe(true)
    expect(isValidPurchaseType('transferencias_saas')).toBe(true)
    expect(isValidPurchaseType('saas_hardware')).toBe(true)
    expect(isValidPurchaseType('otro')).toBe(true)
  })

  it('rechaza el wildcard "all" (lo manejan los callers de metrics aparte)', () => {
    expect(isValidPurchaseType('all')).toBe(false)
  })

  it('rechaza strings desconocidos', () => {
    expect(isValidPurchaseType('planes')).toBe(false)
    expect(isValidPurchaseType('foo')).toBe(false)
    expect(isValidPurchaseType('')).toBe(false)
    expect(isValidPurchaseType('KIT_DIGITAL')).toBe(false) // case sensitive
  })

  it('rechaza tipos no-string', () => {
    expect(isValidPurchaseType(null)).toBe(false)
    expect(isValidPurchaseType(undefined)).toBe(false)
    expect(isValidPurchaseType(42)).toBe(false)
    expect(isValidPurchaseType({})).toBe(false)
    expect(isValidPurchaseType([])).toBe(false)
    expect(isValidPurchaseType(true)).toBe(false)
  })

  it('narrowing del tipo funciona (compile-time check)', () => {
    const candidate: unknown = 'saas_hardware'
    if (isValidPurchaseType(candidate)) {
      // Dentro de este branch, candidate ya es PurchaseType
      const narrowed: PurchaseType = candidate
      expect(narrowed).toBe('saas_hardware')
    }
  })
})
