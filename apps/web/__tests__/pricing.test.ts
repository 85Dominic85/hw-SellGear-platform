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
  computeOrderTotals,
} from '@/lib/pricing'
import type { Order, OrderItem } from '@/types/database'

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

  // Promocion Printer: 100% sobre impresoras
  it('descuento 100% de Impresora WiFi (136,40€)', () => {
    expect(lineDiscountCents(13640, 1, 100)).toBe(13640)
  })

  it('descuento 100% sobre cantidad 2', () => {
    expect(lineDiscountCents(13640, 2, 100)).toBe(27280)
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

  it('Promocion Printer 100%: total = 0', () => {
    // base imponible 0 → IVA 0 → total 0
    expect(lineTotalCents(13640, 1, 100, 21)).toBe(0)
  })

  it('TPV con IGIC 7% (Canarias)', () => {
    // 62700 * 1.07 = 67089
    expect(lineTotalCents(62700, 1, 0, 7)).toBe(67089)
  })

  it('IGIC 7% con descuento 10%', () => {
    // base 56430, IGIC 56430 * 0.07 = 3950.1 → 3950 ; total 60380
    expect(lineTotalCents(62700, 1, 10, 7)).toBe(60380)
  })
})

describe('cartTotals', () => {
  it('carrito vacio devuelve ceros', () => {
    expect(cartTotals([])).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      lineDiscountCents: 0,
      globalDiscountCents: 0,
      manualAdjustmentCents: 0,
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

  it('promocion printer mezclada con TPV normal', () => {
    // Impresora WiFi 100% + TPV sin descuento
    const t = cartTotals([
      { priceCents: 13640, qty: 1, discountPct: 100, vatRate: 21 },
      { priceCents: 62700, qty: 1, discountPct: 0, vatRate: 21 },
    ])
    expect(t.subtotalCents).toBe(76340)
    expect(t.discountCents).toBe(13640)
    expect(t.taxableCents).toBe(62700)
    expect(t.totalCents).toBe(75867)
  })

  it('Canarias: TPV con IGIC 7%', () => {
    const t = cartTotals([{ priceCents: 62700, qty: 1, discountPct: 0, vatRate: 7 }])
    expect(t.subtotalCents).toBe(62700)
    expect(t.discountCents).toBe(0)
    expect(t.taxableCents).toBe(62700)
    expect(t.vatCents).toBe(4389)
    expect(t.totalCents).toBe(67089)
  })

  it('Mezcla IVA + IGIC en distintas lineas', () => {
    // 1 linea TPV 21% peninsular + 1 linea TPV 7% Canarias
    const t = cartTotals([
      { priceCents: 62700, qty: 1, discountPct: 0, vatRate: 21 },
      { priceCents: 62700, qty: 1, discountPct: 0, vatRate: 7 },
    ])
    expect(t.subtotalCents).toBe(125400)
    expect(t.taxableCents).toBe(125400)
    expect(t.vatCents).toBe(13167 + 4389)
    expect(t.totalCents).toBe(125400 + 13167 + 4389)
  })

  // ============================================================
  // Descuento global sobre la base imponible agregada.
  // ============================================================

  it('descuento global 10% sobre una linea IVA 21%', () => {
    // subtotal 100.000c, sin descuento por linea. Global 10% sobre base
    // → dto global = 10.000c. Base final 90.000c. IVA = 90.000*0.21 = 18.900c.
    const t = cartTotals(
      [{ priceCents: 100000, qty: 1, discountPct: 0, vatRate: 21 }],
      10,
    )
    expect(t.subtotalCents).toBe(100000)
    expect(t.lineDiscountCents).toBe(0)
    expect(t.globalDiscountCents).toBe(10000)
    expect(t.discountCents).toBe(10000)
    expect(t.taxableCents).toBe(90000)
    expect(t.vatCents).toBe(18900)
    expect(t.totalCents).toBe(108900)
  })

  it('global 0 se comporta como si no hubiera descuento global', () => {
    const t = cartTotals(
      [{ priceCents: 62700, qty: 1, discountPct: 0, vatRate: 21 }],
      0,
    )
    expect(t.globalDiscountCents).toBe(0)
    expect(t.taxableCents).toBe(62700)
    expect(t.totalCents).toBe(75867)
  })

  it('descuento por linea + global combinados', () => {
    // subtotal 100.000c, dto linea 10% = 10.000c → base pre-global 90.000c.
    // Global 20% sobre 90.000 = 18.000c → base final 72.000c.
    // IVA 21% * 72.000 = 15.120c. Total 87.120c.
    const t = cartTotals(
      [{ priceCents: 100000, qty: 1, discountPct: 10, vatRate: 21 }],
      20,
    )
    expect(t.subtotalCents).toBe(100000)
    expect(t.lineDiscountCents).toBe(10000)
    expect(t.globalDiscountCents).toBe(18000)
    expect(t.discountCents).toBe(28000)
    expect(t.taxableCents).toBe(72000)
    expect(t.vatCents).toBe(15120)
    expect(t.totalCents).toBe(87120)
  })

  it('descuento global prorrateado entre lineas con IVA mixto (Peninsula 21% + Canarias 0%)', () => {
    // Linea A: 60.000c 21% → base 60.000c
    // Linea B: 40.000c  0% → base 40.000c
    // Base agregada 100.000c. Global 10% = 10.000c descuento.
    // Prorrateo: A recibe 10.000 * 60.000/100.000 = 6.000c;
    //            B recibe 10.000 - 6.000 = 4.000c (última absorbe resto).
    // Base final A = 54.000c; IVA A = 54.000 * 0.21 = 11.340c
    // Base final B = 36.000c; IVA B = 0
    // Total = 54.000 + 11.340 + 36.000 + 0 = 101.340c
    const t = cartTotals(
      [
        { priceCents: 60000, qty: 1, discountPct: 0, vatRate: 21 },
        { priceCents: 40000, qty: 1, discountPct: 0, vatRate: 0 },
      ],
      10,
    )
    expect(t.subtotalCents).toBe(100000)
    expect(t.lineDiscountCents).toBe(0)
    expect(t.globalDiscountCents).toBe(10000)
    expect(t.taxableCents).toBe(90000)
    expect(t.vatCents).toBe(11340)
    expect(t.totalCents).toBe(101340)
  })

  it('descuento global 100% deja la base a 0 y el total a 0', () => {
    const t = cartTotals(
      [{ priceCents: 50000, qty: 2, discountPct: 0, vatRate: 21 }],
      100,
    )
    expect(t.subtotalCents).toBe(100000)
    expect(t.globalDiscountCents).toBe(100000)
    expect(t.taxableCents).toBe(0)
    expect(t.vatCents).toBe(0)
    expect(t.totalCents).toBe(0)
  })

  // ============================================================
  // Ajuste manual admin: resta al total c/IVA sin recalcular IVA.
  // ============================================================

  it('ajuste manual 5000c resta al total sin tocar base ni IVA', () => {
    // TPV 62700c IVA 21%: base 62700c, IVA 13167c, total-pre 75867c.
    // Ajuste manual 5000c → total final 70867c.
    const t = cartTotals(
      [{ priceCents: 62700, qty: 1, discountPct: 0, vatRate: 21 }],
      0,
      5000,
    )
    expect(t.taxableCents).toBe(62700)
    expect(t.vatCents).toBe(13167)
    expect(t.manualAdjustmentCents).toBe(5000)
    expect(t.totalCents).toBe(70867)
  })

  it('ajuste manual > total se recorta al total (no queda negativo)', () => {
    const t = cartTotals(
      [{ priceCents: 10000, qty: 1, discountPct: 0, vatRate: 21 }],
      0,
      999999,
    )
    // pre 10000 + 2100 = 12100c → ajuste efectivo 12100c → total 0.
    expect(t.manualAdjustmentCents).toBe(12100)
    expect(t.totalCents).toBe(0)
  })

  it('ajuste manual combinado con descuento global se aplica DESPUÉS del IVA', () => {
    // subtotal 100.000c, dto global 20% → base 80.000c; IVA 21% = 16.800c;
    // total-pre 96.800c. Ajuste manual 2.000c → total final 94.800c.
    // IVA declarado sigue siendo 16.800c (no cambia por el ajuste).
    const t = cartTotals(
      [{ priceCents: 100000, qty: 1, discountPct: 0, vatRate: 21 }],
      20,
      2000,
    )
    expect(t.taxableCents).toBe(80000)
    expect(t.vatCents).toBe(16800)
    expect(t.manualAdjustmentCents).toBe(2000)
    expect(t.totalCents).toBe(94800)
  })

  it('ajuste manual 0 se comporta como si no hubiera ajuste', () => {
    const t = cartTotals(
      [{ priceCents: 62700, qty: 1, discountPct: 0, vatRate: 21 }],
      0,
      0,
    )
    expect(t.manualAdjustmentCents).toBe(0)
    expect(t.totalCents).toBe(75867)
  })

  it('ajuste manual negativo se ignora (clamp a 0)', () => {
    const t = cartTotals(
      [{ priceCents: 62700, qty: 1, discountPct: 0, vatRate: 21 }],
      0,
      -100,
    )
    expect(t.manualAdjustmentCents).toBe(0)
    expect(t.totalCents).toBe(75867)
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

// Helper: construye un OrderItem mock (campos solo relevantes para totals).
function mockItem(partial: Partial<OrderItem>): OrderItem {
  return {
    id: 'item-id',
    order_id: 'order-id',
    product_name: null,
    qty: 1,
    unit_price: null,
    notes: null,
    created_at: '2026-05-21T00:00:00Z',
    product_id: null,
    unit_price_cents: null,
    discount_pct: null,
    vat_rate: null,
    ...partial,
  }
}

function mockOrder(items: OrderItem[]): Order {
  // Solo importan order_items para el helper. El resto del Order se omite
  // como `as Order` porque el helper no toca esos campos.
  return { order_items: items } as Order
}

describe('computeOrderTotals', () => {
  it('pedido moderno con 2 items IVA 21% calcula totales correctos', () => {
    const order = mockOrder([
      mockItem({ qty: 2, unit_price_cents: 50000, discount_pct: 0, vat_rate: 21 }),
      mockItem({ qty: 1, unit_price_cents: 30000, discount_pct: 0, vat_rate: 21 }),
    ])
    const totals = computeOrderTotals(order)
    expect(totals).not.toBeNull()
    // subtotal 100000 + 30000 = 130000; vat 130000 * 0.21 = 27300; total 157300
    expect(totals!.subtotalCents).toBe(130000)
    expect(totals!.taxableCents).toBe(130000)
    expect(totals!.vatCents).toBe(27300)
    expect(totals!.totalCents).toBe(157300)
  })

  it('pedido canario (vat_rate=0, exento) total == base sin impuesto', () => {
    const order = mockOrder([
      mockItem({ qty: 1, unit_price_cents: 199900, discount_pct: 0, vat_rate: 0 }),
    ])
    const totals = computeOrderTotals(order)
    expect(totals).not.toBeNull()
    expect(totals!.taxableCents).toBe(199900)
    expect(totals!.vatCents).toBe(0)
    expect(totals!.totalCents).toBe(199900)
  })

  it('pedido todo legacy (unit_price_cents=null) devuelve null', () => {
    const order = mockOrder([
      mockItem({ qty: 1, unit_price_cents: null, unit_price: 100 }),
      mockItem({ qty: 2, unit_price_cents: null, unit_price: 50 }),
    ])
    expect(computeOrderTotals(order)).toBeNull()
  })

  it('pedido mixto solo usa los modernos para el calculo', () => {
    const order = mockOrder([
      mockItem({ qty: 1, unit_price_cents: 100000, discount_pct: 0, vat_rate: 21 }),
      mockItem({ qty: 5, unit_price_cents: null, unit_price: 50 }), // legacy, ignorado
    ])
    const totals = computeOrderTotals(order)
    expect(totals).not.toBeNull()
    expect(totals!.subtotalCents).toBe(100000)
    expect(totals!.vatCents).toBe(21000)
    expect(totals!.totalCents).toBe(121000)
  })

  it('pedido sin order_items devuelve null', () => {
    expect(computeOrderTotals(mockOrder([]))).toBeNull()
    // Tambien cuando order_items es undefined directamente
    expect(computeOrderTotals({} as Order)).toBeNull()
  })

  it('item moderno con vat_rate=null hace fallback a 21%', () => {
    const order = mockOrder([
      mockItem({ qty: 1, unit_price_cents: 10000, discount_pct: null, vat_rate: null }),
    ])
    const totals = computeOrderTotals(order)
    expect(totals).not.toBeNull()
    // 10000 * 0.21 = 2100; total 12100
    expect(totals!.vatCents).toBe(2100)
    expect(totals!.totalCents).toBe(12100)
  })

  it('order.manual_adjustment_cents se aplica al total final', () => {
    const order = {
      order_items: [
        mockItem({ qty: 1, unit_price_cents: 100000, discount_pct: 0, vat_rate: 21 }),
      ],
      manual_adjustment_cents: 5000,
    } as unknown as Order
    const totals = computeOrderTotals(order)
    expect(totals).not.toBeNull()
    // base 100000 + IVA 21000 = 121000; ajuste 5000 → total 116000
    expect(totals!.taxableCents).toBe(100000)
    expect(totals!.vatCents).toBe(21000)
    expect(totals!.manualAdjustmentCents).toBe(5000)
    expect(totals!.totalCents).toBe(116000)
  })

  it('order.manual_adjustment_cents + discount_global_pct se combinan correctamente', () => {
    const order = {
      order_items: [
        mockItem({ qty: 1, unit_price_cents: 100000, discount_pct: 0, vat_rate: 21 }),
      ],
      discount_global_pct: 10,
      manual_adjustment_cents: 3000,
    } as unknown as Order
    const totals = computeOrderTotals(order)
    expect(totals).not.toBeNull()
    // base pre-global 100000 → global 10% = 10000 → base 90000
    // IVA 21% = 18900 → total-pre 108900 → ajuste 3000 → total 105900
    expect(totals!.taxableCents).toBe(90000)
    expect(totals!.vatCents).toBe(18900)
    expect(totals!.manualAdjustmentCents).toBe(3000)
    expect(totals!.totalCents).toBe(105900)
  })
})
