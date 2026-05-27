'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import type { Product } from '@/types/database'
import { formatEurosCents } from '@/lib/pricing'
import {
  isFinanceableCode,
  financingBaseTotalCents,
  financingInstallments,
} from '@/lib/financing'
import { EMPTY_LINE, type CartLineState } from './CartLine'

interface FinancingCatalogProps {
  products: Product[]
  items: CartLineState[]
  onItemsChange: (items: CartLineState[]) => void
  /** 0 si Canarias (exento), 21 resto. Para mostrar los plazos con IVA. */
  vatRate: number
}

/**
 * Catálogo de financiación: solo los 3 productos financiables, selección
 * ÚNICA (radio). Elegir uno reemplaza el carrito por una sola línea qty 1
 * sin descuento. No hay líneas libres ni control de cantidad: un pedido de
 * financiación es siempre 1 producto.
 */
export default function FinancingCatalog({
  products,
  items,
  onItemsChange,
  vatRate,
}: FinancingCatalogProps) {
  const financeable = useMemo(
    () =>
      products
        .filter((p) => isFinanceableCode(p.code))
        .sort((a, b) => a.sort_order - b.sort_order),
    [products],
  )

  const selectedId = items.find((it) => it.product_id)?.product_id ?? null

  function select(product: Product) {
    onItemsChange([{ ...EMPTY_LINE, product_id: product.id, qty: 1, discount_pct: 0 }])
  }

  if (financeable.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        No hay productos financiables disponibles en el catálogo.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {financeable.map((p) => (
        <FinancingTile
          key={p.id}
          product={p}
          selected={selectedId === p.id}
          vatRate={vatRate}
          onSelect={() => select(p)}
        />
      ))}
    </div>
  )
}

interface FinancingTileProps {
  product: Product
  selected: boolean
  vatRate: number
  onSelect: () => void
}

function FinancingTile({ product, selected, vatRate, onSelect }: FinancingTileProps) {
  const [imgError, setImgError] = useState(false)

  const baseTotal = financingBaseTotalCents(product.code) ?? 0
  const installments = financingInstallments(product.code, vatRate) ?? []
  const totalGross = installments.reduce((s, i) => s + i.grossCents, 0)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex flex-col rounded-xl border bg-white text-left shadow-sm transition-all hover:shadow-md ${
        selected ? 'border-brand ring-2 ring-brand' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Imagen */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-gray-50">
        {!imgError ? (
          <Image
            src={`/products/${product.code}.png`}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain p-3"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-4xl">
            <span aria-hidden="true">💳</span>
          </div>
        )}
        {selected && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
            ✓ Seleccionado
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold leading-tight text-gray-900">{product.name}</h3>

        <div className="mt-1 space-y-1 rounded-lg bg-gray-50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-500">Total a financiar</span>
            <span className="text-base font-bold text-gray-900">
              {formatEurosCents(totalGross)}
            </span>
          </div>
          <div className="text-[11px] text-gray-500">
            Base {formatEurosCents(baseTotal)}
            {vatRate > 0 ? ` + IVA ${vatRate} %` : ' · Exento (Canarias)'}
          </div>
        </div>

        {/* Plan de pagos */}
        <div className="mt-1 space-y-1">
          {installments.map((inst) => (
            <div
              key={inst.stage}
              className="flex items-center justify-between text-xs text-gray-600"
            >
              <span>
                {inst.stage === 1 ? '1er pago (entrada)' : `${inst.stage}.º pago`}
              </span>
              <span className="font-mono tabular-nums font-medium text-gray-900">
                {formatEurosCents(inst.grossCents)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </button>
  )
}
