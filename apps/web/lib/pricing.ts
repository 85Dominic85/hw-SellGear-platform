// =============================================================
// Pricing helpers (cliente + servidor).
// Aritmetica en centimos para evitar errores de coma flotante.
// price_cents siempre SIN IVA. vat_rate y discount_pct en %.
// =============================================================

export interface CartLineInput {
  priceCents: number
  qty: number
  discountPct: number
  vatRate: number
}

export interface CartTotals {
  subtotalCents: number
  discountCents: number
  taxableCents: number
  vatCents: number
  totalCents: number
}

function round(n: number): number {
  return Math.round(n)
}

export function lineSubtotalCents(priceCents: number, qty: number): number {
  return round(priceCents * qty)
}

export function lineDiscountCents(
  priceCents: number,
  qty: number,
  discountPct: number,
): number {
  return round(priceCents * qty * (discountPct / 100))
}

export function lineTaxableCents(
  priceCents: number,
  qty: number,
  discountPct: number,
): number {
  return lineSubtotalCents(priceCents, qty) - lineDiscountCents(priceCents, qty, discountPct)
}

export function lineVatCents(
  priceCents: number,
  qty: number,
  discountPct: number,
  vatRate: number,
): number {
  return round(lineTaxableCents(priceCents, qty, discountPct) * (vatRate / 100))
}

export function lineTotalCents(
  priceCents: number,
  qty: number,
  discountPct: number,
  vatRate: number,
): number {
  return (
    lineTaxableCents(priceCents, qty, discountPct) +
    lineVatCents(priceCents, qty, discountPct, vatRate)
  )
}

export function cartTotals(lines: CartLineInput[]): CartTotals {
  let subtotalCents = 0
  let discountCents = 0
  let vatCents = 0
  for (const l of lines) {
    subtotalCents += lineSubtotalCents(l.priceCents, l.qty)
    discountCents += lineDiscountCents(l.priceCents, l.qty, l.discountPct)
    vatCents += lineVatCents(l.priceCents, l.qty, l.discountPct, l.vatRate)
  }
  const taxableCents = subtotalCents - discountCents
  const totalCents = taxableCents + vatCents
  return { subtotalCents, discountCents, taxableCents, vatCents, totalCents }
}

export function formatEurosCents(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

// =============================================================
// Tipo de impuesto (IVA peninsular 21% / IGIC Canarias 7% legacy / exento)
//
// Convencion actual:
//   vat_rate = 0  -> Exento (Canarias, desde acuerdo del 21-may-2026)
//   vat_rate = 7  -> IGIC 7% (pedidos canarios creados 12-may a 20-may-2026,
//                    se mantienen por snapshot inmutable)
//   vat_rate cualquier otro -> IVA (21% por defecto en peninsula/Baleares)
//
// Asuncion del negocio: el unico caso de vat_rate=0 en este modelo es
// Canarias. Si en el futuro hay productos con otras exenciones (libros,
// formacion, exportaciones), se debe pasar contexto adicional al helper
// (region, motivo) para diferenciar la etiqueta.
// =============================================================

export type TaxType = 'iva' | 'igic' | 'none'

export function taxType(vatRate: number): TaxType {
  if (vatRate === 0) return 'none'
  if (vatRate === 7) return 'igic'
  return 'iva'
}

export function taxLabel(vatRate: number): string {
  const tt = taxType(vatRate)
  if (tt === 'igic') return `IGIC ${vatRate} %`
  if (tt === 'none') return 'Exento (Canarias)'
  return `IVA ${vatRate} %`
}

/**
 * Etiqueta para un conjunto de tasas. Si todas las lineas comparten tasa,
 * devuelve la etiqueta de esa tasa; si hay mezcla, "Impuestos (mixto)".
 */
export function effectiveTaxLabel(rates: number[]): string {
  const unique = Array.from(new Set(rates))
  if (unique.length === 0) return ''
  if (unique.length === 1) return taxLabel(unique[0])
  return 'Impuestos (mixto)'
}

// =============================================================
// Desglose de totales a partir de order_items modernos.
// =============================================================

import type { Order } from '@/types/database'

/**
 * Calcula los totales del pedido a partir de sus order_items con desglose
 * "moderno" (unit_price_cents poblado). Devuelve null si el pedido no
 * tiene desglose por linea: el caller debe hacer fallback al order.amount
 * plano (pedidos legacy de Typeform y similares).
 *
 * Items mixtos (alguno moderno + alguno legacy) -> usa solo los modernos.
 * Items con vat_rate=null -> fallback a 21 % (peninsular).
 * Items con discount_pct=null -> fallback a 0.
 */
export function computeOrderTotals(order: Order): CartTotals | null {
  const items = order.order_items ?? []
  const modern = items.filter(
    (i) => i.unit_price_cents !== null && i.unit_price_cents !== undefined,
  )
  if (modern.length === 0) return null
  return cartTotals(
    modern.map((i) => ({
      priceCents: i.unit_price_cents!,
      qty: i.qty,
      discountPct: i.discount_pct ?? 0,
      vatRate: i.vat_rate ?? 21,
    })),
  )
}
