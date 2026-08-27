// =============================================================
// Detalle por línea del carrito, en un solo sitio.
//
// El mismo cálculo (precio unitario efectivo, nombre a mostrar, subtotal,
// descuento en euros) estaba escrito cuatro veces: CartSummary.detailed,
// CartFab.detalle, OrderReviewModal.detailed y otra vez dentro del <ul> de
// productos de OrderReviewModal — que además ya se había desviado, porque
// ahí el importe de la línea se pinta SIN restar el descuento.
//
// Al tenerlo aquí, la lista de productos y los totales leen la misma cifra
// por construcción, no por disciplina.
//
// Módulo puro: sin React, testeable sin renderizar.
// =============================================================

import type { Product } from '@/types/database'
import type { CartLineInput } from '@/lib/pricing'
import { lineDiscountCents, lineSubtotalCents } from '@/lib/pricing'
import { isFreePrice } from '@/lib/product-rules'
import { GIFT_DISCOUNT_PCT, type CartLineState } from '@/lib/catalog/rules'

export interface CartLineDetail {
  /** Índice en el array original: los reducers trabajan por posición. */
  index: number
  line: CartLineState
  /** `null` si la línea todavía no tiene producto elegido. */
  product: Product | null
  /** Nombre a mostrar: el override del AE gana al del catálogo. */
  name: string
  /** Precio unitario efectivo (override si el producto es de precio libre). */
  unitPriceCents: number
  qty: number
  discountPct: number
  vatRate: number
  /** qty × precio, sin descuento. */
  subtotalCents: number
  /** Descuento de la línea en euros. */
  discountCents: number
  /** Lo que aporta la línea a la base imponible: subtotal − descuento. */
  netCents: number
  /** Descuento del 100 %: la marca de "regalo" que entiende el wizard. */
  isGift: boolean
  /** Precio libre al que le falta el importe: no suma nada todavía. */
  pendingPrice: boolean
  packageCount: number
}

/**
 * Precio unitario que se usa para calcular. Para los productos de precio
 * libre manda SIEMPRE el importe que introduce el AE, igual que hace el
 * servidor en POST /api/orders (allí `product.price_cents` se sobreescribe
 * con `unit_price_override_cents` y este es obligatorio). Así el preview no
 * puede prometer un precio distinto del que se va a facturar.
 */
export function effectiveUnitPriceCents(
  line: CartLineState,
  product: Product | null,
): number {
  if (!product) return 0
  if (isFreePrice(product)) return line.unit_price_override_cents ?? 0
  return product.price_cents
}

/**
 * Detalle de cada línea del carrito.
 *
 * Devuelve TODAS las líneas, incluidas las que aún no tienen producto: la
 * lista de productos tiene que poder enseñar "(sin definir)" para que el AE
 * vea que hay una línea a medio rellenar. Para los totales, filtra por
 * `product` (ver `totalsInput`).
 *
 * @param vatRateOverride sobreescribe el IVA de todas las líneas en el
 *   preview (CP canario ⇒ 0). Es solo UI: el servidor recalcula al insertar.
 */
export function cartLineDetails(
  lines: CartLineState[],
  products: Product[],
  vatRateOverride: number | null = null,
): CartLineDetail[] {
  const byId = new Map(products.map((p) => [p.id, p]))

  return lines.map((line, index) => {
    const product = line.product_id ? byId.get(line.product_id) ?? null : null
    const unitPriceCents = effectiveUnitPriceCents(line, product)
    const subtotalCents = lineSubtotalCents(unitPriceCents, line.qty)
    const discountCents = lineDiscountCents(
      unitPriceCents,
      line.qty,
      line.discount_pct,
    )
    return {
      index,
      line,
      product,
      name:
        line.product_name_override.trim() || product?.name || '(sin definir)',
      unitPriceCents,
      qty: line.qty,
      discountPct: line.discount_pct,
      vatRate: vatRateOverride ?? (product ? Number(product.vat_rate) : 21),
      subtotalCents,
      discountCents,
      netCents: subtotalCents - discountCents,
      isGift: line.discount_pct === GIFT_DISCOUNT_PCT,
      pendingPrice: Boolean(
        product && isFreePrice(product) && unitPriceCents <= 0,
      ),
      packageCount: product?.package_count ?? 0,
    }
  })
}

/**
 * Entrada para `cartTotals`. Descarta las líneas sin producto, que es lo que
 * hacen también las validaciones del paso 2 y del servidor.
 */
export function totalsInput(details: CartLineDetail[]): CartLineInput[] {
  return details
    .filter((d) => d.product !== null)
    .map((d) => ({
      priceCents: d.unitPriceCents,
      qty: d.qty,
      discountPct: d.discountPct,
      vatRate: d.vatRate,
    }))
}

/** Bultos estimados para TIPSA. */
export function totalPackages(details: CartLineDetail[]): number {
  return details.reduce((sum, d) => sum + d.qty * d.packageCount, 0)
}
