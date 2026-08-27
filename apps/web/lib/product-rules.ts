// =============================================================
// Reglas de negocio por producto, en un solo sitio.
//
// Antes de este módulo, el predicado "este producto lleva precio negociado"
// estaba escrito a mano 9 veces en 7 ficheros (CartLine, CartSummary,
// OrderReviewModal, AddOrderItemModal, ProductCatalog, orders/new/page,
// api/orders, api/orders/[id]/items). Cada servicio nuevo de precio a medida
// obligaba a editarlos todos, y ya se habían desincronizado.
//
// La causa era que el hecho no estaba en la BD. Ahora sí: `pricing_mode` y
// `allows_discount` (migración 20260825000001) lo declaran por fila, y este
// módulo los lee.
//
// FALLBACK LEGACY: el SQL se aplica a mano (CLAUDE.md), así que existe una
// ventana con código nuevo y BD vieja. Mientras las columnas lleguen
// `undefined`, se deduce por `code`. Ver LEGACY_* más abajo.
//
// Módulo puro, sin 'use client': lo importan route handlers y componentes.
// =============================================================

import type {
  Product,
  ProductPricingMode,
  ProductRegion,
  PurchaseType,
} from '@/types/database'
import { isFinanceableCode } from '@/lib/financing'

/** Subconjunto de columnas que necesitan estas reglas. */
export type ProductLike = Pick<Product, 'code' | 'category'> &
  Partial<
    Pick<
      Product,
      | 'name'
      | 'price_cents'
      | 'pricing_mode'
      | 'allows_discount'
      | 'region'
      | 'image_url'
      | 'standalone_price_cents'
    >
  >

// -------------------------------------------------------------
// Fallback legacy (borrar cuando 20260825000002 esté aplicada en producción)
// -------------------------------------------------------------

/** Precio libre + descripción libre. */
const LEGACY_FREE_PRICE_NAMED = ['otro', 'saas_hardware'] as const
/** Precio libre, nombre fijo del catálogo. */
const LEGACY_FREE_PRICE = ['implementacion-pro', 'software-qamarero'] as const

/** SKU que nunca admite descuento (precio negociado = precio final). */
const LEGACY_NO_DISCOUNT = ['saas_hardware'] as const

function legacyPricingMode(p: ProductLike): ProductPricingMode {
  if ((LEGACY_FREE_PRICE_NAMED as readonly string[]).includes(p.code)) {
    return 'free_price_named'
  }
  if ((LEGACY_FREE_PRICE as readonly string[]).includes(p.code)) {
    return 'free_price'
  }
  // La categoría vieja `saas_hardware` cubría cualquier SKU de oferta mixta.
  if (p.category === 'saas_hardware') return 'free_price_named'
  return 'catalog'
}

// -------------------------------------------------------------
// Lectores con fallback
// -------------------------------------------------------------

export function pricingMode(p: ProductLike | null | undefined): ProductPricingMode {
  if (!p) return 'catalog'
  return p.pricing_mode ?? legacyPricingMode(p)
}

export function productRegion(p: ProductLike | null | undefined): ProductRegion {
  return p?.region ?? 'peninsula'
}

/** El AE introduce el precio unitario: `unit_price_override_cents` obligatorio. */
export function isFreePrice(p: ProductLike | null | undefined): boolean {
  const mode = pricingMode(p)
  return mode === 'free_price' || mode === 'free_price_named'
}

/** El AE introduce además la descripción: `product_name_override` obligatorio. */
export function needsCustomName(p: ProductLike | null | undefined): boolean {
  return pricingMode(p) === 'free_price_named'
}

/**
 * Precio de referencia (PVP) de un producto de precio libre, o `null` si no
 * tiene tarifa.
 *
 * En los modos de precio libre `price_cents` NO es el importe que se factura
 * —eso siempre es el snapshot `order_items.unit_price_cents` que introduce el
 * AE, y el servidor lo exige— sino el precio de partida del servicio.
 * Implementación Pro tiene PVP (500 €) y lo que varía es el descuento que le
 * aplique el comercial; Software Qamarero y las ofertas mixtas se cotizan de
 * cero, así que se quedan a 0 y siguen mostrando «Precio a medida».
 *
 * Antes de esto la tarjeta ponía «Precio a medida» para los tres y el AE
 * tenía que saberse la tarifa de memoria.
 */
export function referencePriceCents(
  p: ProductLike | null | undefined,
): number | null {
  if (!isFreePrice(p)) return null
  const cents = p?.price_cents ?? 0
  return cents > 0 ? cents : null
}

/** `false` ⇒ `discount_pct` debe ser 0. */
export function allowsLineDiscount(p: ProductLike | null | undefined): boolean {
  if (!p) return true
  if (typeof p.allows_discount === 'boolean') return p.allows_discount
  return !(LEGACY_NO_DISCOUNT as readonly string[]).includes(p.code) &&
    p.category !== 'saas_hardware'
}

/** Solo se puede vender con dirección de envío canaria (precio final, IVA 0). */
export function requiresCanaryShipping(p: ProductLike | null | undefined): boolean {
  return productRegion(p) === 'canarias'
}

/** Admite pedidos `hardware_financiacion`. */
export function isFinanceable(p: ProductLike | null | undefined): boolean {
  return p ? isFinanceableCode(p.code) : false
}

/**
 * `otro` es el mecanismo de "línea libre", no un producto: no debe salir como
 * tarjeta en el catálogo. El resto de SKU sin precio de catálogo (servicios,
 * ofertas mixtas) sí tienen tarjeta, con la etiqueta "Precio a medida".
 */
export function isHiddenFromCatalog(p: ProductLike | null | undefined): boolean {
  return !p || p.code === 'otro' || p.category === 'custom'
}

// -------------------------------------------------------------
// Struct agregado
// -------------------------------------------------------------

export interface ProductRules {
  freePrice: boolean
  needsName: boolean
  discountLocked: boolean
  financeable: boolean
  hiddenFromCatalog: boolean
  region: ProductRegion
  requiresCanaryShipping: boolean
}

/**
 * Todas las reglas de una vez. Úsalo donde hagan falta varias
 * (CartLine, OrderReviewModal); para una sola, los predicados sueltos
 * expresan mejor la intención en un route handler.
 */
export function productRules(p: ProductLike | null | undefined): ProductRules {
  return {
    freePrice: isFreePrice(p),
    needsName: needsCustomName(p),
    discountLocked: !allowsLineDiscount(p),
    financeable: isFinanceable(p),
    hiddenFromCatalog: isHiddenFromCatalog(p),
    region: productRegion(p),
    requiresCanaryShipping: requiresCanaryShipping(p),
  }
}

// -------------------------------------------------------------
// Mensajes y etiquetas
// Reemplazan los ternarios de 4 ramas duplicados en api/orders/route.ts,
// api/orders/[id]/items/route.ts, orders/new/page.tsx y CartLine.tsx.
// -------------------------------------------------------------

/** Etiqueta del input de precio negociado. */
export function freePriceLabel(p: ProductLike): string {
  if (p.category === 'saas_hardware' || needsCustomName(p)) {
    return p.code === 'otro'
      ? 'Precio unitario s/IVA (€)'
      : 'Precio negociado s/IVA (€)'
  }
  return 'Precio acordado s/IVA (€)'
}

/** Etiqueta del input de descripción libre. */
export function customNameLabel(p: ProductLike): string {
  return p.category === 'saas_hardware' || p.code === 'saas_hardware'
    ? 'Descripción de la oferta SaaS + Hardware'
    : 'Descripción del producto'
}

/** Placeholder del input de descripción libre. */
export function customNamePlaceholder(p: ProductLike): string {
  return p.category === 'saas_hardware' || p.code === 'saas_hardware'
    ? 'Ej: SaaS 12 meses + 2 TPV + 1 KDS'
    : 'Ej: Soporte para tablet personalizado'
}

export function missingPriceError(p: ProductLike): string {
  const label = p.name ?? p.code
  return `Falta el precio de "${label}": este producto lleva precio acordado con el cliente.`
}

export function missingNameError(p: ProductLike): string {
  const label = p.name ?? p.code
  return `Falta la descripción de "${label}".`
}

export function canaryShippingError(p: ProductLike): string {
  const label = p.name ?? p.code
  return `"${label}" solo puede venderse con dirección de envío en Canarias (CP 35xxx/38xxx).`
}

// -------------------------------------------------------------
// Imagen y precios derivados
// -------------------------------------------------------------

/** Placeholder vectorial para producto sin foto. Copiado del catálogo web. */
export const PRODUCT_IMAGE_FALLBACK = '/products/_pending.svg'

/**
 * Los dos únicos SKU cuya imagen es .svg y no .webp. Solo hace falta para la
 * ventana pre-migración: a partir de 20260825000002 la ruta viene en
 * `image_url`. Borrar con el resto del fallback legacy.
 */
const LEGACY_SVG_CODES = ['implementacion-pro', 'software-qamarero'] as const

/**
 * Ruta de la imagen, o `null` si el producto no tiene foto (entonces la
 * tarjeta pinta el icono de su familia).
 *
 * Antes se derivaba de `code` en el cliente con una cadena de `onError`
 * png → svg → emoji y dos `useState` por tarjeta. Ahora la fuente es
 * `image_url` y la resolución es determinista.
 *
 * La distinción entre `undefined` y `null` es deliberada y es lo que permite
 * desplegar sin imágenes roscas:
 *   undefined → la columna todavía no existe (BD pre-migración) ⇒ se deriva
 *               del `code`, que es como funcionaba antes.
 *   null      → la columna existe y dice que NO hay imagen ⇒ icono.
 */
export function productImageUrl(
  p: ProductLike | null | undefined,
): string | null {
  if (!p) return null
  if (p.image_url) return p.image_url
  // Columna presente y vacía: el producto no tiene foto a propósito
  // (saas_hardware, otro).
  if (p.image_url === null) return null
  // Columna ausente: BD pre-migración, se deriva como antes.
  const ext = (LEGACY_SVG_CODES as readonly string[]).includes(p.code)
    ? 'svg'
    : 'webp'
  return `/products/${p.code}.${ext}`
}

/** Suma de los componentes comprados por separado, o `null` si no hay desglose. */
export function standalonePriceCents(p: ProductLike | null | undefined): number | null {
  return p?.standalone_price_cents ?? null
}

/**
 * Ahorro del pack frente a comprar los componentes por separado.
 * Puede ser negativo: hay packs donde la preconfiguración añade coste, y el
 * catálogo web lo muestra como "Preconfigurado: +X €".
 */
export function packSavingCents(p: ProductLike | null | undefined): number | null {
  const standalone = standalonePriceCents(p)
  if (standalone === null || p?.price_cents === undefined) return null
  return standalone - p.price_cents
}

// -------------------------------------------------------------
// Visibilidad en el catálogo
// Unifica el filtro que estaba repartido entre ProductCatalog.tsx:88-101 y
// AddOrderItemModal.tsx:137.
// -------------------------------------------------------------

/** Solo estos dos SKU se venden en pedidos de transferencias SaaS. */
export const SAAS_ONLY_CODES = ['implementacion-pro', 'software-qamarero'] as const

export interface CatalogVisibilityContext {
  purchaseType?: PurchaseType | ''
  region?: ProductRegion
}

export function isCatalogVisible(
  p: ProductLike,
  ctx: CatalogVisibilityContext = {},
): boolean {
  if (isHiddenFromCatalog(p)) return false

  // Transferencias SaaS no envía hardware: solo software e implementación.
  if (ctx.purchaseType === 'transferencias_saas') {
    return (SAAS_ONLY_CODES as readonly string[]).includes(p.code)
  }

  // Software Qamarero solo es válido en transferencias SaaS.
  if (p.code === 'software-qamarero') return false

  // Península y Canarias son listas de precios distintas: nunca se mezclan.
  return productRegion(p) === (ctx.region ?? 'peninsula')
}
