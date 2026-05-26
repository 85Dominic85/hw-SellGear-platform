'use client'

import ProductPicker from './ProductPicker'
import type { Product } from '@/types/database'
import { lineTotalCents, formatEurosCents } from '@/lib/pricing'

export interface CartLineState {
  product_id: string | null
  product_name_override: string
  unit_price_override_cents: number | null
  qty: number
  /**
   * Descuento por linea. 100 solo es valido cuando el producto es de
   * categoria 'printer' (Promocion Printer); para el resto, 0 o 10.
   */
  discount_pct: 0 | 10 | 100
}

export const EMPTY_LINE: CartLineState = {
  product_id: null,
  product_name_override: '',
  unit_price_override_cents: null,
  qty: 1,
  discount_pct: 0,
}

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
   * Para lineas libres ('otro' / 'saas_hardware') es false: el AE sigue
   * pudiendo elegir entre los dos SKUs especiales.
   */
  lockProduct?: boolean
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
}: CartLineProps) {
  const product = products.find((p) => p.id === line.product_id) ?? null
  // Productos con precio libre negociado por el AE/AM:
  //   - code='otro' (cualquier item ad-hoc)
  //   - category='saas_hardware' (ofertas SaaS + Hardware)
  // Ambos activan los inputs extra de descripcion + precio en euros.
  const isFreePrice =
    product?.code === 'otro' || product?.category === 'saas_hardware'

  const priceCents = isFreePrice
    ? line.unit_price_override_cents ?? 0
    : product?.price_cents ?? 0
  const vatRate =
    vatRateOverride ?? (product ? Number(product.vat_rate) : 21)

  const lineTotal = product
    ? lineTotalCents(priceCents, line.qty, line.discount_pct, vatRate)
    : 0

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500'

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        {/* Selector producto */}
        <div className="sm:col-span-5">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Producto
          </label>
          <ProductPicker
            value={line.product_id}
            onChange={(productId) => {
              // Resets de descuento al cambiar de producto para no dejar
              // estados invalidos al usuario:
              //   - 100 (Promocion Printer) si el nuevo NO es printer.
              //   - Cualquier descuento != 0 si el nuevo es saas_hardware
              //     (precio libre negociado: el precio ES el final).
              const newProduct = products.find((p) => p.id === productId)
              const resetForPrinterPromo =
                line.discount_pct === 100 && newProduct?.category !== 'printer'
              const resetForSaasHw =
                newProduct?.category === 'saas_hardware' &&
                line.discount_pct !== 0
              const resetDiscount = resetForPrinterPromo || resetForSaasHw
              onChange(index, {
                product_id: productId,
                product_name_override: '',
                unit_price_override_cents: null,
                ...(resetDiscount ? { discount_pct: 0 as const } : {}),
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
            value={line.qty}
            onChange={(e) =>
              onChange(index, {
                qty: Math.max(1, parseInt(e.target.value) || 1),
              })
            }
            className={`${inputClass} text-center`}
          />
        </div>

        {/* Descuento */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Descuento
          </label>
          <select
            value={line.discount_pct}
            onChange={(e) => {
              // saas_hardware fuerza 0 (precio negociado = precio final).
              if (product?.category === 'saas_hardware') {
                onChange(index, { discount_pct: 0 })
                return
              }
              const v = parseInt(e.target.value)
              const next: 0 | 10 | 100 =
                v === 100 && product?.category === 'printer'
                  ? 100
                  : v === 10
                    ? 10
                    : 0
              onChange(index, { discount_pct: next })
            }}
            className={inputClass}
            disabled={product?.category === 'saas_hardware'}
            title={
              product?.category === 'saas_hardware'
                ? 'SaaS + Hardware no admite descuento (precio negociado es el final).'
                : undefined
            }
          >
            <option value={0}>Sin descuento</option>
            {product?.category !== 'saas_hardware' && (
              <option value={10}>-10 %</option>
            )}
            {product?.category === 'printer' && (
              <option value={100}>Promoción Printer (-100 %)</option>
            )}
          </select>
        </div>

        {/* Total línea (con IVA) */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Total c/IVA
          </label>
          <div className="rounded-lg border border-transparent bg-white px-3 py-2 text-sm font-medium text-gray-900">
            {product ? formatEurosCents(lineTotal) : '—'}
          </div>
        </div>

        {/* Eliminar */}
        <div className="flex items-end sm:col-span-1">
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={!canRemove}
            className="flex h-9 w-full items-center justify-center rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
            title="Eliminar línea"
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

      {/* Inputs extra cuando code='otro' o category='saas_hardware' (precio libre) */}
      {isFreePrice && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {product?.category === 'saas_hardware'
                ? 'Descripción de la oferta SaaS + Hardware'
                : 'Descripción del producto'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={line.product_name_override}
              onChange={(e) =>
                onChange(index, { product_name_override: e.target.value })
              }
              placeholder={
                product?.category === 'saas_hardware'
                  ? 'Ej: SaaS 12 meses + 2 TPV + 1 KDS'
                  : 'Ej: Soporte para tablet personalizado'
              }
              maxLength={200}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {product?.category === 'saas_hardware'
                ? 'Precio negociado s/IVA (€)'
                : 'Precio unitario s/IVA (€)'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
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
            />
          </div>
        </div>
      )}
    </div>
  )
}
