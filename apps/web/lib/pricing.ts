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
  /** Suma de descuentos por línea + descuento global (para vista agregada). */
  discountCents: number
  /** Descuento por línea (sin global). */
  lineDiscountCents: number
  /** Descuento global aplicado sobre la base imponible pre-global. */
  globalDiscountCents: number
  /** Ajuste manual (céntimos) que se resta al total c/IVA. No modifica base
   *  ni IVA declarado (decisión de negocio: es un descuento comercial
   *  post-cálculo). Solo lo pueden aplicar admins. */
  manualAdjustmentCents: number
  /** Base imponible después de TODOS los descuentos (por línea + global). */
  taxableCents: number
  vatCents: number
  /** Total c/IVA final = taxable + vat − manualAdjustment (nunca negativo). */
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

/**
 * Calcula los totales de un carrito, opcionalmente aplicando un descuento
 * global (%) sobre la base imponible AGREGADA (después del descuento por
 * línea, ANTES del IVA).
 *
 * El descuento global se distribuye entre las líneas proporcionalmente
 * a su base imponible pre-global. Esto es fiscalmente correcto cuando
 * el carrito mezcla líneas con IVA distinto (21% Península + 0% Canarias,
 * o 7% IGIC legacy):
 *
 *   Fase 1  base_linea_pre = subtotal_linea - descuento_linea
 *   Fase 2  base_pre_agregada = Σ base_linea_pre
 *           dto_global = round(base_pre_agregada * globalPct/100)
 *   Fase 3  dto_asignado_i = round(dto_global * base_linea_pre_i / base_pre_agregada)
 *           (la última línea absorbe el remanente de redondeo)
 *   Fase 4  base_linea_final_i = base_linea_pre_i - dto_asignado_i
 *   Fase 5  iva_linea_i = round(base_linea_final_i * vat_rate_i/100)
 *   Fase 6  total = Σ (base_linea_final_i + iva_linea_i)
 *
 * Si globalPct = 0 (default), el comportamiento es idéntico al anterior.
 */
export function cartTotals(
  lines: CartLineInput[],
  globalPct = 0,
  manualAdjustmentCents = 0,
): CartTotals {
  // Fase 1: por línea, subtotal + descuento línea + base pre-global.
  const perLinePre = lines.map((l) => {
    const subtotal = lineSubtotalCents(l.priceCents, l.qty)
    const lineDiscount = lineDiscountCents(l.priceCents, l.qty, l.discountPct)
    const taxablePre = subtotal - lineDiscount
    return { subtotal, lineDiscount, taxablePre, vatRate: l.vatRate }
  })

  const subtotalCents = perLinePre.reduce((s, x) => s + x.subtotal, 0)
  const lineDiscountTotal = perLinePre.reduce((s, x) => s + x.lineDiscount, 0)
  const taxablePreGlobal = perLinePre.reduce((s, x) => s + x.taxablePre, 0)

  // Fase 2: descuento global (round sobre la base agregada).
  const globalDiscountCents =
    globalPct > 0 && taxablePreGlobal > 0
      ? round(taxablePreGlobal * (globalPct / 100))
      : 0

  // Fase 3-5: distribuir global entre líneas + recalcular IVA por línea.
  let vatCents = 0
  let assignedGlobal = 0
  perLinePre.forEach((line, i) => {
    // Asignación proporcional del descuento global a esta línea.
    // Última línea absorbe el remanente para que Σ asignaciones = globalDiscountCents.
    const isLast = i === perLinePre.length - 1
    const rawAssign =
      taxablePreGlobal > 0
        ? round((globalDiscountCents * line.taxablePre) / taxablePreGlobal)
        : 0
    const assignThis = isLast ? globalDiscountCents - assignedGlobal : rawAssign
    assignedGlobal += assignThis

    // Base final tras descontar la parte proporcional del global.
    const taxableFinal = Math.max(0, line.taxablePre - assignThis)
    // IVA sobre la base final (redondeado por línea, como antes).
    vatCents += round(taxableFinal * (line.vatRate / 100))
  })

  const taxableCents = taxablePreGlobal - globalDiscountCents
  const discountCents = lineDiscountTotal + globalDiscountCents
  const preAdjustmentTotal = taxableCents + vatCents
  const clampedAdjustment = Math.max(
    0,
    Math.min(preAdjustmentTotal, Math.floor(Number(manualAdjustmentCents) || 0)),
  )
  const totalCents = preAdjustmentTotal - clampedAdjustment

  return {
    subtotalCents,
    discountCents,
    lineDiscountCents: lineDiscountTotal,
    globalDiscountCents,
    manualAdjustmentCents: clampedAdjustment,
    taxableCents,
    vatCents,
    totalCents,
  }
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
 * Aplica orders.discount_global_pct si está presente. Fallbacks:
 *   - Items mixtos (alguno moderno + alguno legacy) -> usa solo los modernos.
 *   - Items con vat_rate=null -> fallback a 21 % (peninsular).
 *   - Items con discount_pct=null -> fallback a 0.
 */
export function computeOrderTotals(order: Order): CartTotals | null {
  const items = order.order_items ?? []
  const modern = items.filter(
    (i) => i.unit_price_cents !== null && i.unit_price_cents !== undefined,
  )
  if (modern.length === 0) return null
  const globalPct = order.discount_global_pct ?? 0
  const manualAdjustment = order.manual_adjustment_cents ?? 0
  return cartTotals(
    modern.map((i) => ({
      priceCents: i.unit_price_cents!,
      qty: i.qty,
      discountPct: i.discount_pct ?? 0,
      vatRate: i.vat_rate ?? 21,
    })),
    globalPct,
    manualAdjustment,
  )
}
