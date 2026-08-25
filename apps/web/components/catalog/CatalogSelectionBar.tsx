'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Trash2 } from 'lucide-react'
import type { Product } from '@/types/database'
import { cartTotals } from '@/lib/pricing'
import { formatCatalogPrice } from '@/lib/catalog/format'
import { buildNewOrderHref } from '@/lib/catalog/order-link'
import { isFreePrice } from '@/lib/product-rules'
import { useCatalogSelection } from './CatalogSelectionProvider'

interface CatalogSelectionBarProps {
  products: Product[]
  /** `viewer` puede consultar el catálogo pero no crear pedidos. */
  canCreateOrder: boolean
}

/**
 * Barra sticky con la selección y el salto al pedido.
 *
 * El origen usaba una píldora en su header + un drawer lateral. Aquí no hay
 * header propio, así que la selección vive abajo, que es el patrón correcto
 * dentro de una herramienta: siempre visible sin robar espacio a la rejilla.
 */
export default function CatalogSelectionBar({
  products,
  canCreateOrder,
}: CatalogSelectionBarProps) {
  const router = useRouter()
  const { picks, totalUnits, clear, asPicks } = useCatalogSelection()

  if (picks.size === 0) return null

  const byCode = new Map(products.map((p) => [p.code, p]))
  const selected = [...picks]
    .map(([code, qty]) => ({ product: byCode.get(code), qty }))
    .filter((x): x is { product: Product; qty: number } => Boolean(x.product))

  // Los productos de precio libre no cuentan para el total: su importe se
  // acuerda en el pedido. Se avisa aparte en vez de sumarlos como 0 sin decir
  // nada.
  const priced = selected.filter((x) => !isFreePrice(x.product))
  const pendingCount = selected.length - priced.length

  // Preview al 21 %: el IVA real depende del CP, que se pide en el paso 3.
  // Para Canarias el vat_rate del producto ya es 0.
  const totals = cartTotals(
    priced.map((x) => ({
      priceCents: x.product.price_cents,
      qty: x.qty,
      discountPct: 0,
      vatRate: Number(x.product.vat_rate),
    })),
  )

  return (
    <div className="selection-bar section-shell" role="region" aria-label="Selección actual">
      <div className="selection-bar-info">
        <span className="selection-bar-count">
          <b>{totalUnits}</b>
          {totalUnits === 1 ? 'unidad' : 'unidades'}
          {' · '}
          {picks.size} {picks.size === 1 ? 'referencia' : 'referencias'}
        </span>
        <span className="selection-bar-total">
          {formatCatalogPrice(totals.totalCents)}
          <small>
            IVA incluido, orientativo
            {pendingCount > 0 &&
              ` · ${pendingCount} con precio a convenir`}
          </small>
        </span>
      </div>

      <div className="selection-bar-actions">
        <button type="button" className="text-button" onClick={clear}>
          <Trash2 size={16} aria-hidden="true" /> Vaciar
        </button>
        {canCreateOrder && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => router.push(buildNewOrderHref(asPicks()))}
          >
            Continuar al pedido <ArrowRight size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
