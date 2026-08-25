// =============================================================
// Tests: lib/catalog/rules.ts — reducers del carrito.
//
// Estas reglas vivían dentro de ProductCatalog.tsx, donde no había forma de
// probarlas sin renderizar. El invariante que más importa es el del regalo:
// quitar Implementación Pro tiene que arrastrar la tablet de 100 % de
// descuento, o queda una tablet gratis sin el servicio que la justifica.
// =============================================================

import { describe, it, expect } from 'vitest'
import type { Product } from '@/types/database'
import {
  EMPTY_LINE,
  GIFT_DISCOUNT_PCT,
  IMPL_PRO_CODE,
  TABLET_GIFT_CODE,
  applyAddFreeLine,
  applyAddProduct,
  applyAddTabletGift,
  applyAdjustQty,
  applyDeclineTabletGift,
  applyRemoveLine,
  applySelectFinanced,
  applyUpdateLine,
  findByCode,
  hasProduct,
  qtyByProduct,
  tabletGiftIndex,
  type CartLineState,
} from '@/lib/catalog/rules'

function product(id: string, code: string, priceCents = 10000): Product {
  return {
    id,
    code,
    name: code,
    description: null,
    category: 'accessory',
    price_cents: priceCents,
    vat_rate: 21,
    package_count: 1,
    active: true,
    sort_order: 0,
    created_at: '',
    updated_at: '',
  }
}

const tpv = product('id-tpv', 'tpv-pro', 62700)
const implPro = product('id-impl', IMPL_PRO_CODE, 0)
const tablet = product('id-tablet', TABLET_GIFT_CODE, 19900)
const CATALOG = [tpv, implPro, tablet]

const line = (over: Partial<CartLineState>): CartLineState => ({
  ...EMPTY_LINE,
  ...over,
})

describe('applyAddProduct', () => {
  it('añade una línea nueva con cantidad 1', () => {
    const next = applyAddProduct([], tpv)
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ product_id: tpv.id, qty: 1, discount_pct: 0 })
  })

  it('suma cantidad si el producto ya está', () => {
    const next = applyAddProduct([line({ product_id: tpv.id, qty: 2 })], tpv)
    expect(next).toHaveLength(1)
    expect(next[0].qty).toBe(3)
  })

  it('no muta el array de entrada', () => {
    const items = [line({ product_id: tpv.id, qty: 1 })]
    const next = applyAddProduct(items, tpv)
    expect(items[0].qty).toBe(1)
    expect(next).not.toBe(items)
  })
})

describe('applyAdjustQty', () => {
  it('sube y baja la cantidad', () => {
    const items = [line({ product_id: tpv.id, qty: 2 })]
    expect(applyAdjustQty(items, tpv.id, 1)[0].qty).toBe(3)
    expect(applyAdjustQty(items, tpv.id, -1)[0].qty).toBe(1)
  })

  it('elimina la línea al llegar a 0', () => {
    const items = [line({ product_id: tpv.id, qty: 1 })]
    expect(applyAdjustQty(items, tpv.id, -1)).toHaveLength(0)
  })

  it('ignora un producto que no está en el carrito', () => {
    const items = [line({ product_id: tpv.id, qty: 1 })]
    expect(applyAdjustQty(items, 'inexistente', -1)).toBe(items)
  })

  it('quitar Implementación Pro arrastra la tablet regalo', () => {
    const items = [
      line({ product_id: implPro.id, qty: 1, unit_price_override_cents: 50000 }),
      line({ product_id: tablet.id, qty: 1, discount_pct: GIFT_DISCOUNT_PCT }),
    ]
    const next = applyAdjustQty(items, implPro.id, -1, { implPro, tablet })
    expect(next).toHaveLength(0)
  })

  it('pero NO arrastra una tablet comprada aparte', () => {
    // Sin descuento 100 % no es un regalo: es una tablet que el cliente paga.
    const items = [
      line({ product_id: implPro.id, qty: 1 }),
      line({ product_id: tablet.id, qty: 1, discount_pct: 0 }),
    ]
    const next = applyAdjustQty(items, implPro.id, -1, { implPro, tablet })
    expect(next).toHaveLength(1)
    expect(next[0].product_id).toBe(tablet.id)
  })

  it('bajar Implementación Pro sin llegar a 0 no toca el regalo', () => {
    const items = [
      line({ product_id: implPro.id, qty: 2 }),
      line({ product_id: tablet.id, qty: 1, discount_pct: GIFT_DISCOUNT_PCT }),
    ]
    const next = applyAdjustQty(items, implPro.id, -1, { implPro, tablet })
    expect(next).toHaveLength(2)
    expect(next[0].qty).toBe(1)
  })
})

describe('tablet regalo', () => {
  it('la añade con 100 % de descuento', () => {
    const next = applyAddTabletGift([], tablet)
    expect(next[0]).toMatchObject({
      product_id: tablet.id,
      qty: 1,
      discount_pct: GIFT_DISCOUNT_PCT,
    })
  })

  it('es idempotente', () => {
    const once = applyAddTabletGift([], tablet)
    expect(applyAddTabletGift(once, tablet)).toBe(once)
  })

  it('sin tablet en el catálogo no hace nada', () => {
    const items: CartLineState[] = []
    expect(applyAddTabletGift(items, null)).toBe(items)
  })

  it('declinar quita solo la línea de regalo', () => {
    const items = [
      line({ product_id: tpv.id, qty: 1 }),
      line({ product_id: tablet.id, qty: 1, discount_pct: GIFT_DISCOUNT_PCT }),
    ]
    const next = applyDeclineTabletGift(items, tablet)
    expect(next).toHaveLength(1)
    expect(next[0].product_id).toBe(tpv.id)
  })

  it('tabletGiftIndex localiza la línea por SKU + descuento', () => {
    const items = [
      line({ product_id: tablet.id, qty: 1, discount_pct: 0 }),
      line({ product_id: tablet.id, qty: 1, discount_pct: GIFT_DISCOUNT_PCT }),
    ]
    expect(tabletGiftIndex(items, tablet)).toBe(1)
    expect(tabletGiftIndex(items, null)).toBe(-1)
  })
})

describe('líneas libres y utilidades', () => {
  it('applyAddFreeLine añade una línea en blanco', () => {
    const next = applyAddFreeLine([])
    expect(next[0]).toEqual(EMPTY_LINE)
    expect(next[0].product_id).toBeNull()
  })

  it('applyUpdateLine solo toca el índice indicado', () => {
    const items = [line({ qty: 1 }), line({ qty: 5 })]
    const next = applyUpdateLine(items, 1, { qty: 9 })
    expect(next[0].qty).toBe(1)
    expect(next[1].qty).toBe(9)
  })

  it('applyRemoveLine quita por índice', () => {
    const items = [line({ qty: 1 }), line({ qty: 2 })]
    expect(applyRemoveLine(items, 0)).toHaveLength(1)
    expect(applyRemoveLine(items, 0)[0].qty).toBe(2)
  })

  it('qtyByProduct agrega y salta líneas sin producto', () => {
    const map = qtyByProduct([
      line({ product_id: tpv.id, qty: 2 }),
      line({ product_id: tpv.id, qty: 3 }),
      line({ product_id: null, qty: 7 }),
    ])
    expect(map.get(tpv.id)).toBe(5)
    expect(map.size).toBe(1)
  })

  it('hasProduct y findByCode', () => {
    expect(hasProduct([line({ product_id: tpv.id })], tpv.id)).toBe(true)
    expect(hasProduct([], tpv.id)).toBe(false)
    expect(findByCode(CATALOG, TABLET_GIFT_CODE)).toBe(tablet)
    expect(findByCode(CATALOG, 'no-existe')).toBeNull()
  })
})

describe('applySelectFinanced', () => {
  it('reemplaza el carrito por una única línea sin descuento', () => {
    // Es lo que valida POST /api/orders para hardware_financiacion.
    const next = applySelectFinanced(tpv)
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ product_id: tpv.id, qty: 1, discount_pct: 0 })
  })
})
