// =============================================================
// Reglas del carrito como funciones puras.
//
// Estas reglas vivían dentro de ProductCatalog.tsx (líneas 78-236), así que
// solo existían para el paso 2 del wizard: la ruta /catalogo no podía
// reutilizarlas, y AddOrderItemModal se vio obligado a reimplementar la del
// regalo de tablet por su cuenta. Al ser reducers puros sobre
// CartLineState[] se comparten entre las tres superficies y son testeables
// sin renderizar nada.
//
// CartLineState y EMPTY_LINE se definen AQUÍ (y CartLine.tsx los reexporta
// por compatibilidad): el estado del carrito es un dato, no un detalle de un
// componente, y así este módulo no depende de React.
// =============================================================

import type { Product } from '@/types/database'

export interface CartLineState {
  product_id: string | null
  product_name_override: string
  unit_price_override_cents: number | null
  qty: number
  /**
   * Descuento por línea. Rango libre 0-100 entero. Los productos con
   * `allows_discount = false` fuerzan 0 (ver lib/product-rules.ts). La
   * financiación también rechaza != 0 en POST /api/orders.
   */
  discount_pct: number
}

export const EMPTY_LINE: CartLineState = {
  product_id: null,
  product_name_override: '',
  unit_price_override_cents: null,
  qty: 1,
  discount_pct: 0,
}

// -------------------------------------------------------------
// SKU con reglas propias
// -------------------------------------------------------------

/** Servicio de implementación: al añadirlo se pregunta por la tablet regalo. */
export const IMPL_PRO_CODE = 'implementacion-pro'
/** Tablet que se regala con Implementación Pro (línea con descuento 100 %). */
export const TABLET_GIFT_CODE = 'tablet-kds-lenovo'
/** Nota que deja rastro del regalo en la ficha del pedido. */
export const TABLET_GIFT_NOTE = 'Regalo por Implementación Pro'
/** Descuento que marca una línea como regalo. */
export const GIFT_DISCOUNT_PCT = 100

// -------------------------------------------------------------
// Consultas
// -------------------------------------------------------------

export function findByCode(products: Product[], code: string): Product | null {
  return products.find((p) => p.code === code) ?? null
}

/** Mapa product_id -> unidades en el carrito, para el badge de la tarjeta. */
export function qtyByProduct(items: CartLineState[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const it of items) {
    if (!it.product_id) continue
    map.set(it.product_id, (map.get(it.product_id) ?? 0) + it.qty)
  }
  return map
}

export function hasProduct(items: CartLineState[], productId: string): boolean {
  return items.some((it) => it.product_id === productId)
}

/**
 * Índice de la línea de tablet regalo, o -1. Se identifica por SKU + descuento
 * 100 %: el servidor no distingue un regalo de un descuento manual del 100 %,
 * así que esta es la única marca que hay.
 */
export function tabletGiftIndex(
  items: CartLineState[],
  tablet: Product | null,
): number {
  if (!tablet) return -1
  return items.findIndex(
    (it) => it.product_id === tablet.id && it.discount_pct === GIFT_DISCOUNT_PCT,
  )
}

// -------------------------------------------------------------
// Reducers — siempre devuelven un array nuevo, nunca mutan
// -------------------------------------------------------------

/** Añade el producto, o suma 1 si ya está en el carrito. */
export function applyAddProduct(
  items: CartLineState[],
  product: Product,
  qty = 1,
): CartLineState[] {
  const idx = items.findIndex((it) => it.product_id === product.id)
  if (idx >= 0) {
    const next = [...items]
    next[idx] = { ...next[idx], qty: next[idx].qty + qty }
    return next
  }
  return [...items, { ...EMPTY_LINE, product_id: product.id, qty }]
}

/**
 * Suma `delta` a la cantidad. Si llega a 0 la línea se elimina, y si el
 * producto retirado era Implementación Pro se retira TAMBIÉN la tablet
 * regalo: quedaría una tablet gratis sin el servicio que la justifica.
 */
export function applyAdjustQty(
  items: CartLineState[],
  productId: string,
  delta: number,
  ctx: { implPro?: Product | null; tablet?: Product | null } = {},
): CartLineState[] {
  const idx = items.findIndex((it) => it.product_id === productId)
  if (idx < 0) return items

  const newQty = items[idx].qty + delta
  if (newQty > 0) {
    const next = [...items]
    next[idx] = { ...next[idx], qty: newQty }
    return next
  }

  let next = items.filter((_, i) => i !== idx)
  const { implPro, tablet } = ctx
  if (implPro && tablet && productId === implPro.id) {
    next = next.filter(
      (it) =>
        !(it.product_id === tablet.id && it.discount_pct === GIFT_DISCOUNT_PCT),
    )
  }
  return next
}

/** Añade la tablet como regalo (descuento 100 %). Idempotente. */
export function applyAddTabletGift(
  items: CartLineState[],
  tablet: Product | null,
): CartLineState[] {
  if (!tablet || tabletGiftIndex(items, tablet) >= 0) return items
  return [
    ...items,
    {
      ...EMPTY_LINE,
      product_id: tablet.id,
      qty: 1,
      discount_pct: GIFT_DISCOUNT_PCT,
    },
  ]
}

/** Quita la línea de tablet regalo si la hubiera. */
export function applyDeclineTabletGift(
  items: CartLineState[],
  tablet: Product | null,
): CartLineState[] {
  const idx = tabletGiftIndex(items, tablet)
  return idx >= 0 ? items.filter((_, i) => i !== idx) : items
}

/** Línea en blanco para producto fuera de catálogo u oferta mixta. */
export function applyAddFreeLine(items: CartLineState[]): CartLineState[] {
  return [...items, { ...EMPTY_LINE }]
}

export function applyUpdateLine(
  items: CartLineState[],
  index: number,
  partial: Partial<CartLineState>,
): CartLineState[] {
  return items.map((it, i) => (i === index ? { ...it, ...partial } : it))
}

export function applyRemoveLine(
  items: CartLineState[],
  index: number,
): CartLineState[] {
  return items.filter((_, i) => i !== index)
}

/**
 * Financiación: selección única. Reemplaza el carrito entero por una sola
 * línea con cantidad 1 y sin descuento, que es lo que valida
 * POST /api/orders para `hardware_financiacion`.
 */
export function applySelectFinanced(product: Product): CartLineState[] {
  return [{ ...EMPTY_LINE, product_id: product.id, qty: 1, discount_pct: 0 }]
}
