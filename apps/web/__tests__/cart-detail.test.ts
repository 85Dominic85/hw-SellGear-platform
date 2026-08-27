// =============================================================
// Tests: lib/cart-detail.ts — detalle por línea del carrito.
//
// Este cálculo estaba copiado cuatro veces (CartSummary, CartFab y dos veces
// dentro de OrderReviewModal) y ya se había desviado: la lista de productos
// de la revisión final pintaba el importe SIN restar el descuento, así que la
// tablet regalo salía a 199 € aunque no se cobrase. Lo que se prueba aquí es
// justo eso: que `netCents` es lo que la línea aporta de verdad.
// =============================================================

import { describe, it, expect } from 'vitest'
import type { Product } from '@/types/database'
import {
  cartLineDetails,
  effectiveUnitPriceCents,
  totalPackages,
  totalsInput,
} from '@/lib/cart-detail'
import { EMPTY_LINE, GIFT_DISCOUNT_PCT, type CartLineState } from '@/lib/catalog/rules'

function product(over: Partial<Product> & Pick<Product, 'id' | 'code'>): Product {
  return {
    name: over.code,
    description: null,
    category: 'accessory',
    price_cents: 10000,
    vat_rate: 21,
    package_count: 1,
    active: true,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...over,
  } as Product
}

const tpv = product({ id: 'id-tpv', code: 'tpv-pro', price_cents: 62700, package_count: 2 })
const tablet = product({ id: 'id-tablet', code: 'tablet-kds-lenovo', price_cents: 19900 })
// Precio libre CON tarifa: Implementación Pro después de la migración.
const implPro = product({
  id: 'id-impl',
  code: 'implementacion-pro',
  name: 'Implementación Pro',
  category: 'service',
  price_cents: 50000,
  pricing_mode: 'free_price',
})
// Precio libre SIN tarifa.
const software = product({
  id: 'id-soft',
  code: 'software-qamarero',
  category: 'service',
  price_cents: 0,
  pricing_mode: 'free_price',
})

const CATALOG = [tpv, tablet, implPro, software]
const line = (over: Partial<CartLineState>): CartLineState => ({
  ...EMPTY_LINE,
  ...over,
})

describe('effectiveUnitPriceCents', () => {
  it('un producto de catálogo usa su precio de tarifa', () => {
    expect(effectiveUnitPriceCents(line({ product_id: tpv.id }), tpv)).toBe(62700)
  })

  it('un producto de precio libre usa el importe del AE, no la tarifa', () => {
    // Aunque implPro tenga 500 € de referencia, manda lo que teclea el AE.
    const l = line({ product_id: implPro.id, unit_price_override_cents: 35000 })
    expect(effectiveUnitPriceCents(l, implPro)).toBe(35000)
  })

  it('precio libre sin importe todavía vale 0', () => {
    const l = line({ product_id: software.id, unit_price_override_cents: null })
    expect(effectiveUnitPriceCents(l, software)).toBe(0)
  })

  it('sin producto vale 0', () => {
    expect(effectiveUnitPriceCents(line({}), null)).toBe(0)
  })
})

describe('cartLineDetails', () => {
  it('calcula subtotal, descuento y neto de una línea con descuento', () => {
    const details = cartLineDetails(
      [line({ product_id: tpv.id, qty: 2, discount_pct: 10 })],
      CATALOG,
    )
    expect(details).toHaveLength(1)
    expect(details[0]).toMatchObject({
      index: 0,
      name: 'tpv-pro',
      unitPriceCents: 62700,
      qty: 2,
      subtotalCents: 125400,
      discountCents: 12540,
      netCents: 112860,
      isGift: false,
      pendingPrice: false,
    })
  })

  it('la línea regalo aporta 0, no el precio de la tablet', () => {
    const details = cartLineDetails(
      [line({ product_id: tablet.id, qty: 1, discount_pct: GIFT_DISCOUNT_PCT })],
      CATALOG,
    )
    expect(details[0].isGift).toBe(true)
    expect(details[0].subtotalCents).toBe(19900)
    expect(details[0].netCents).toBe(0)
  })

  it('marca pendingPrice solo en precio libre sin importe', () => {
    const details = cartLineDetails(
      [
        line({ product_id: software.id }),
        line({ product_id: implPro.id, unit_price_override_cents: 50000 }),
        line({ product_id: tpv.id }),
      ],
      CATALOG,
    )
    expect(details.map((d) => d.pendingPrice)).toEqual([true, false, false])
  })

  it('el nombre que escribe el AE gana al del catálogo', () => {
    const details = cartLineDetails(
      [line({ product_id: implPro.id, product_name_override: '  Implantación a medida  ' })],
      CATALOG,
    )
    expect(details[0].name).toBe('Implantación a medida')
  })

  it('devuelve también las líneas sin producto, para poder listarlas', () => {
    const details = cartLineDetails([line({}), line({ product_id: tpv.id })], CATALOG)
    expect(details).toHaveLength(2)
    expect(details[0].product).toBeNull()
    expect(details[0].name).toBe('(sin definir)')
    expect(details[0].pendingPrice).toBe(false)
  })

  it('un product_id que no está en el catálogo no revienta', () => {
    const details = cartLineDetails([line({ product_id: 'fantasma' })], CATALOG)
    expect(details[0].product).toBeNull()
    expect(details[0].unitPriceCents).toBe(0)
  })

  it('vatRateOverride pisa el IVA de todas las líneas (CP canario)', () => {
    const details = cartLineDetails([line({ product_id: tpv.id })], CATALOG, 0)
    expect(details[0].vatRate).toBe(0)
  })

  it('el índice es el del array original, no el del filtrado', () => {
    const details = cartLineDetails(
      [line({}), line({ product_id: tpv.id })],
      CATALOG,
    )
    expect(details.map((d) => d.index)).toEqual([0, 1])
  })
})

describe('totalsInput', () => {
  it('descarta las líneas sin producto', () => {
    const details = cartLineDetails([line({}), line({ product_id: tpv.id })], CATALOG)
    const input = totalsInput(details)
    expect(input).toHaveLength(1)
    expect(input[0]).toEqual({
      priceCents: 62700,
      qty: 1,
      discountPct: 0,
      vatRate: 21,
    })
  })
})

describe('totalPackages', () => {
  it('multiplica bultos por cantidad', () => {
    const details = cartLineDetails(
      [line({ product_id: tpv.id, qty: 3 }), line({ product_id: tablet.id, qty: 2 })],
      CATALOG,
    )
    // tpv: 3 x 2 bultos = 6 ; tablet: 2 x 1 = 2
    expect(totalPackages(details)).toBe(8)
  })

  it('una línea sin producto no aporta bultos', () => {
    expect(totalPackages(cartLineDetails([line({})], CATALOG))).toBe(0)
  })
})
