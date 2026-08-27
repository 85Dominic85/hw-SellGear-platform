// =============================================================
// Tests: validateLineDiscount + validateGlobalDiscount (helpers puros)
//
// El modelo pasa de un set fijo {0, 10, 100} a un rango libre 0-100
// (entero). Los productos con allows_discount = false siguen bloqueados a 0.
//
// validateLineDiscount recibe el PRODUCTO, no su categoría: la regla vive en
// la fila (products.allows_discount) y no en un `code` hardcodeado. El helper
// `prod()` construye el mínimo que necesitan las reglas.
// =============================================================

import { describe, it, expect } from 'vitest'
import {
  MAX_UNIT_PRICE_CENTS,
  validateLineDiscount,
  validateGlobalDiscount,
  validateUnitPriceCents,
} from '@/lib/orders-validation'
import type { ProductLike } from '@/lib/product-rules'
import type { ProductCategory } from '@/types/database'

/** Producto de catálogo normal en la categoría dada. */
function prod(category: ProductCategory): ProductLike {
  return { code: `sku-${category}`, category, allows_discount: true }
}

/** Oferta de precio cerrado: no admite descuento. */
const closedOffer: ProductLike = {
  code: 'saas_hardware',
  category: 'service',
  allows_discount: false,
}

/**
 * Fila aún sin migrar (columna ausente): las reglas deducen por `code` y
 * `category`. Cubre la ventana en la que la BD todavía no tiene los flags.
 */
const legacyClosedOffer: ProductLike = {
  code: 'saas_hardware',
  category: 'saas_hardware',
}

describe('validateLineDiscount', () => {
  it('acepta 0 con cualquier categoria', () => {
    expect(validateLineDiscount(0, prod('tpv')).ok).toBe(true)
    expect(validateLineDiscount(0, prod('pack')).ok).toBe(true)
    expect(validateLineDiscount(0, prod('printer')).ok).toBe(true)
    expect(validateLineDiscount(0, prod('network')).ok).toBe(true)
  })

  it('acepta cualquier entero 1-99 en cualquier categoria excepto saas_hardware', () => {
    expect(validateLineDiscount(5, prod('tpv')).ok).toBe(true)
    expect(validateLineDiscount(12, prod('kds')).ok).toBe(true)
    expect(validateLineDiscount(25, prod('pack')).ok).toBe(true)
    expect(validateLineDiscount(50, prod('accessory')).ok).toBe(true)
    expect(validateLineDiscount(75, prod('network')).ok).toBe(true)
    expect(validateLineDiscount(99, prod('printer')).ok).toBe(true)
  })

  it('acepta 100 con cualquier categoria excepto saas_hardware', () => {
    // Con el rango libre ya no hay regla especial "solo printer" para 100%.
    expect(validateLineDiscount(100, prod('printer')).ok).toBe(true)
    expect(validateLineDiscount(100, prod('tpv')).ok).toBe(true)
    expect(validateLineDiscount(100, prod('pack')).ok).toBe(true)
    expect(validateLineDiscount(100, null).ok).toBe(true)
  })

  it('rechaza fuera de rango (negativo o >100)', () => {
    expect(validateLineDiscount(-1, prod('tpv')).ok).toBe(false)
    expect(validateLineDiscount(-10, prod('tpv')).ok).toBe(false)
    expect(validateLineDiscount(101, prod('printer')).ok).toBe(false)
    expect(validateLineDiscount(200, prod('kds')).ok).toBe(false)
  })

  it('rechaza decimales (solo enteros)', () => {
    expect(validateLineDiscount(10.5, prod('tpv')).ok).toBe(false)
    expect(validateLineDiscount(12.34, prod('pack')).ok).toBe(false)
    expect(validateLineDiscount(0.1, prod('printer')).ok).toBe(false)
  })

  it('rechaza tipos invalidos', () => {
    expect(validateLineDiscount('10' as unknown as number, prod('tpv')).ok).toBe(false)
    expect(validateLineDiscount(NaN, prod('tpv')).ok).toBe(false)
    expect(validateLineDiscount(Infinity, prod('tpv')).ok).toBe(false)
    expect(validateLineDiscount(null as unknown as number, prod('tpv')).ok).toBe(false)
    expect(validateLineDiscount(undefined as unknown as number, prod('tpv')).ok).toBe(false)
  })

  it('saas_hardware fuerza descuento 0', () => {
    const ok = validateLineDiscount(0, closedOffer)
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.pct).toBe(0)
  })

  it('rechaza cualquier descuento != 0 con saas_hardware', () => {
    const r10 = validateLineDiscount(10, closedOffer)
    expect(r10.ok).toBe(false)
    if (!r10.ok) expect(r10.error).toMatch(/saas \+ hardware/i)

    expect(validateLineDiscount(25, closedOffer).ok).toBe(false)
    expect(validateLineDiscount(100, closedOffer).ok).toBe(false)
  })

  it('bloquea igual con la fila sin migrar (fallback por code/category)', () => {
    // Ventana de despliegue: el SQL se aplica a mano, así que el código tiene
    // que seguir bloqueando aunque allows_discount aún no exista en la fila.
    expect(validateLineDiscount(0, legacyClosedOffer).ok).toBe(true)
    expect(validateLineDiscount(10, legacyClosedOffer).ok).toBe(false)
    expect(validateLineDiscount(100, legacyClosedOffer).ok).toBe(false)
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

describe('validateUnitPriceCents', () => {
  // order_items.unit_price_cents es INTEGER; orders.amount es NUMERIC(12,2) y
  // aguanta mucho más. Un importe entre los dos límites dejaba el pedido
  // creado y el insert de líneas reventado, y como ese fallo solo se registra
  // con console.error la API respondía 200 con un pedido de cero artículos.
  it('acepta un importe normal', () => {
    expect(validateUnitPriceCents(50000, 'Implementación Pro')).toEqual({
      ok: true,
      cents: 50000,
    })
  })

  it('acepta 0 (línea de catálogo a precio 0 o regalo)', () => {
    expect(validateUnitPriceCents(0, 'X')).toEqual({ ok: true, cents: 0 })
  })

  it('acepta exactamente el máximo de la columna', () => {
    const r = validateUnitPriceCents(MAX_UNIT_PRICE_CENTS, 'X')
    expect(r.ok).toBe(true)
  })

  it('rechaza un céntimo por encima del máximo, que es lo que rompía el insert', () => {
    const r = validateUnitPriceCents(MAX_UNIT_PRICE_CENTS + 1, 'Implementación Pro')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Implementación Pro')
  })

  it('rechaza negativos, decimales y no-números', () => {
    expect(validateUnitPriceCents(-1, 'X').ok).toBe(false)
    expect(validateUnitPriceCents(10.5, 'X').ok).toBe(false)
    expect(validateUnitPriceCents('50000', 'X').ok).toBe(false)
    expect(validateUnitPriceCents(NaN, 'X').ok).toBe(false)
    expect(validateUnitPriceCents(Infinity, 'X').ok).toBe(false)
    expect(validateUnitPriceCents(null, 'X').ok).toBe(false)
  })
})
