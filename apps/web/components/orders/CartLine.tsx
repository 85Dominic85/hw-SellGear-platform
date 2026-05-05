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
}

export default function CartLine({
  line,
  products,
  index,
  canRemove,
  onChange,
  onRemove,
}: CartLineProps) {
  const product = products.find((p) => p.id === line.product_id) ?? null
  const isOtro = product?.code === 'otro'

  const priceCents = isOtro
    ? line.unit_price_override_cents ?? 0
    : product?.price_cents ?? 0
  const vatRate = product ? Number(product.vat_rate) : 21

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
              // Si el descuento actual es 100 (Promocion Printer) y el nuevo
              // producto NO es de categoria printer, resetear a 0 para no
              // dejar un estado invalido al usuario.
              const newProduct = products.find((p) => p.id === productId)
              const resetDiscount =
                line.discount_pct === 100 && newProduct?.category !== 'printer'
              onChange(index, {
                product_id: productId,
                product_name_override: '',
                unit_price_override_cents: null,
                ...(resetDiscount ? { discount_pct: 0 as const } : {}),
              })
            }}
            products={products}
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
          >
            <option value={0}>Sin descuento</option>
            <option value={10}>-10 %</option>
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

      {/* Inputs extra cuando code='otro' */}
      {isOtro && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Descripción del producto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={line.product_name_override}
              onChange={(e) =>
                onChange(index, { product_name_override: e.target.value })
              }
              placeholder="Ej: Soporte para tablet personalizado"
              maxLength={200}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Precio unitario s/IVA (€) <span className="text-red-500">*</span>
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
