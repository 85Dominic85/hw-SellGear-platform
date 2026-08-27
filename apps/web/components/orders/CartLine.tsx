'use client'

import ProductPicker from './ProductPicker'
import type { Product } from '@/types/database'
import { lineTotalCents, formatEurosCents } from '@/lib/pricing'
import type { CartLineState } from '@/lib/catalog/rules'
import {
  allowsLineDiscount,
  customNameLabel,
  customNamePlaceholder,
  freePriceLabel,
  isFreePrice,
  needsCustomName,
  referencePriceCents,
} from '@/lib/product-rules'
import { MAX_QTY } from '@/lib/catalog/order-link'
import { MAX_UNIT_PRICE_CENTS } from '@/lib/orders-validation'

// El estado del carrito y sus reducers viven en lib/catalog/rules.ts (dato
// puro, compartido con /catalogo y con el modal de la ficha de pedido). Aquí
// se reexportan para no romper los imports existentes.
export type { CartLineState } from '@/lib/catalog/rules'
export { EMPTY_LINE } from '@/lib/catalog/rules'

interface CartLineProps {
  line: CartLineState
  products: Product[]
  index: number
  canRemove: boolean
  onChange: (index: number, partial: Partial<CartLineState>) => void
  onRemove: (index: number) => void
  /**
   * Si se provee, sobreescribe vat_rate del producto en el preview de la
   * linea (ej. IGIC 7 % cuando shipping_cp es canario). Es solo UI; el
   * servidor recalcula al insertar.
   */
  vatRateOverride?: number | null
  /**
   * Si es true, el ProductPicker queda deshabilitado. Lo usa el wizard
   * cuando el producto se anadio via tile del cat (ProductCatalog) — el
   * AE no debe cambiar el SKU desde aqui, solo qty / descuento / quitar.
   * Para lineas libres es false: el AE sigue pudiendo elegir entre los SKU
   * de precio libre con descripcion (pricing_mode = 'free_price_named').
   */
  lockProduct?: boolean
  /**
   * Bloquea el descuento de ESTA línea (no del producto).
   * Lo usa el paso 2 con la línea de tablet regalo: su 100 % no es un
   * descuento comercial, es la única marca que distingue un regalo de un
   * descuento manual (ver tabletGiftIndex en lib/catalog/rules.ts). Si el AE
   * lo cambiara, el panel «¿incluye tablet como regalo?» dejaría de
   * reconocerla y «Sí, añadir» metería una segunda tablet. Para retirar el
   * regalo está «No, sin tablet».
   */
  lockDiscount?: boolean
  /**
   * Bloquea la cantidad de ESTA línea a la que ya tiene.
   * Lo usa el paso 2 en los productos de precio libre y en la línea de
   * regalo: la tarjeta del catálogo ya los trata como cantidad fija a 1
   * (`lockQty` de AddToOrderButton), así que dejar aquí un input libre
   * permitía escribir 4 y quedarse con cuatro implantaciones —o cuatro
   * tablets gratis— mientras la tarjeta seguía diciendo «Añadido».
   */
  lockQty?: boolean
  /** Marca visible de línea de regalo, para que no parezca una línea normal. */
  isGift?: boolean
}

export default function CartLine({
  line,
  products,
  index,
  canRemove,
  onChange,
  onRemove,
  vatRateOverride = null,
  lockProduct = false,
  lockDiscount = false,
  lockQty = false,
  isGift = false,
}: CartLineProps) {
  const product = products.find((p) => p.id === line.product_id) ?? null
  // Reglas del producto (precio libre, descripción libre, descuento) — viven
  // en products.pricing_mode / allows_discount, no en un `code` hardcodeado.
  const freePrice = isFreePrice(product)
  const needsName = needsCustomName(product)
  const discountLocked = lockDiscount || !allowsLineDiscount(product)

  const priceCents = freePrice
    ? line.unit_price_override_cents ?? 0
    : product?.price_cents ?? 0
  const vatRate =
    vatRateOverride ?? (product ? Number(product.vat_rate) : 21)

  const lineTotal = product
    ? lineTotalCents(priceCents, line.qty, line.discount_pct, vatRate)
    : 0

  /**
   * Nombre para los `aria-label`. Con una línea por producto en el paso 2,
   * un lector de pantalla recorría dos docenas de spinbuttons sin nombre: el
   * único sitio donde estaba el producto era un `select` deshabilitado, que
   * además queda fuera del orden de tabulación.
   */
  const rotulo =
    line.product_name_override.trim() || product?.name || `línea ${index + 1}`

  // min-h-11 = 44px, el objetivo táctil que ya cumplen CartFab y
  // AddToOrderButton. Antes eran 38px, y ahora se repiten por cada línea.
  const inputClass =
    'w-full min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500'

  return (
    <div
      className={`rounded-lg border p-3 ${
        isGift
          ? 'border-brand/40 bg-brand/5'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      {isGift && (
        <p className="mb-2 text-xs font-medium text-brand-hover">
          🎁 Regalo por Implementación Pro · cantidad y descuento fijos. Para
          retirarlo, «No, sin tablet» en el panel de arriba.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        {/* Selector producto */}
        <div className="sm:col-span-5">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Producto
          </label>
          <ProductPicker
            value={line.product_id}
            onChange={(productId) => {
              // Reset del descuento al cambiar de producto solo si el nuevo
              // no admite descuento (precio negociado = precio final). Para
              // el resto preservamos el descuento 0-100 que ya hubiera.
              const newProduct = products.find((p) => p.id === productId)
              const mustReset =
                !allowsLineDiscount(newProduct) && line.discount_pct !== 0
              onChange(index, {
                product_id: productId,
                product_name_override: '',
                // El importe del producto anterior no puede quedarse pegado,
                // pero el del nuevo sí se aplica si tiene tarifa: si no, el
                // mismo SKU entraba con 500 € desde su tarjeta y en blanco
                // desde este selector.
                unit_price_override_cents: referencePriceCents(newProduct),
                ...(mustReset ? { discount_pct: 0 } : {}),
              })
            }}
            products={products}
            disabled={lockProduct}
          />
        </div>

        {/* Cantidad */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Cantidad
          </label>
          <input
            type="number"
            min={1}
            max={MAX_QTY}
            value={line.qty}
            onChange={(e) => {
              const raw = parseInt(e.target.value, 10)
              const clamped = Number.isFinite(raw)
                ? Math.max(1, Math.min(MAX_QTY, raw))
                : 1
              onChange(index, { qty: clamped })
            }}
            className={`${inputClass} text-center`}
            disabled={lockQty}
            aria-label={`Cantidad de ${rotulo}`}
            title={
              lockQty
                ? isGift
                  ? 'La línea de regalo es de una unidad.'
                  : 'Este producto se vende por unidad.'
                : `Cantidad: entre 1 y ${MAX_QTY}`
            }
          />
        </div>

        {/* Descuento — rango libre 0-100 entero; saas_hardware forzado a 0 */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Descuento (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={line.discount_pct}
            onChange={(e) => {
              if (discountLocked) {
                onChange(index, { discount_pct: 0 })
                return
              }
              const raw = parseInt(e.target.value, 10)
              const clamped = Number.isFinite(raw)
                ? Math.max(0, Math.min(100, raw))
                : 0
              onChange(index, { discount_pct: clamped })
            }}
            className={`${inputClass} text-center`}
            disabled={discountLocked}
            aria-label={`Descuento en % de ${rotulo}`}
            title={
              lockDiscount
                ? 'Es la línea del regalo por Implementación Pro. Para retirarla usa «No, sin tablet».'
                : discountLocked
                  ? 'Esta oferta no admite descuento (el precio negociado ya es el final).'
                  : 'Descuento por línea: entero entre 0 y 100'
            }
          />
        </div>

        {/* Total línea. Con vat_rate 0 (Canarias) rotularlo "c/IVA" afirmaría
            un impuesto que no existe en esa línea. */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {vatRate > 0 ? 'Total c/IVA' : 'Total'}
          </label>
          <div className="flex min-h-11 items-center rounded-lg border border-transparent bg-white px-3 text-sm font-medium text-gray-900">
            {product ? formatEurosCents(lineTotal) : '—'}
          </div>
        </div>

        {/* Eliminar */}
        <div className="flex items-end sm:col-span-1">
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={!canRemove}
            className="flex h-11 w-full items-center justify-center rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Quitar ${rotulo} del pedido`}
            title={`Quitar ${rotulo}`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Inputs extra cuando el producto tiene precio libre.
          - Descripción: SOLO si el producto la necesita (otro/saas_hardware).
          - Precio: SIEMPRE (obligatorio). */}
      {freePrice && (
        <div
          className={`mt-3 grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 ${
            needsName ? 'sm:grid-cols-2' : ''
          }`}
        >
          {needsName && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                {product ? customNameLabel(product) : 'Descripción del producto'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={line.product_name_override}
                onChange={(e) =>
                  onChange(index, { product_name_override: e.target.value })
                }
                placeholder={
                  product ? customNamePlaceholder(product) : 'Ej: Soporte para tablet personalizado'
                }
                maxLength={200}
                className={inputClass}
                aria-label={`Descripción de ${rotulo}`}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {product ? freePriceLabel(product) : 'Precio unitario s/IVA (€)'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              // Tope de la columna order_items.unit_price_cents (INTEGER). El
              // servidor lo rechaza con 400; aquí evita llegar hasta ahí.
              max={MAX_UNIT_PRICE_CENTS / 100}
              step={0.01}
              value={
                line.unit_price_override_cents === null
                  ? ''
                  : (line.unit_price_override_cents / 100).toString()
              }
              onChange={(e) => {
                const v = e.target.value
                onChange(index, {
                  unit_price_override_cents:
                    v === '' ? null : Math.round(parseFloat(v) * 100),
                })
              }}
              placeholder="0,00"
              className={inputClass}
              aria-label={`Precio unitario sin IVA de ${rotulo}`}
            />
          </div>
        </div>
      )}
    </div>
  )
}
