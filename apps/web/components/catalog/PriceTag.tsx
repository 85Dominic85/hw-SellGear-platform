import type { Product } from '@/types/database'
import { formatCatalogPrice, priceSuffix } from '@/lib/catalog/format'
import { isFreePrice } from '@/lib/product-rules'

interface PriceTagProps {
  product: Product
  /** `detail` usa la tipografía grande de la ficha. */
  variant?: 'card' | 'detail'
}

/**
 * Precio de catálogo, o el estado "a convenir" de los productos con precio
 * negociado. El catálogo NO tarifica esos productos: el importe se introduce
 * en la línea del pedido, así que aquí decirlo es más honesto que inventar
 * una cifra.
 */
export default function PriceTag({ product, variant = 'card' }: PriceTagProps) {
  const pending = isFreePrice(product)
  const base = variant === 'detail' ? 'detail-price' : 'price'

  if (pending) {
    return (
      <div
        className={
          variant === 'detail'
            ? 'detail-price detail-price-pending'
            : 'price price-pending'
        }
      >
        <strong>Precio a medida</strong>
        <small>Se acuerda con el cliente en el pedido</small>
      </div>
    )
  }

  return (
    <div className={base}>
      <strong>{formatCatalogPrice(product.price_cents)}</strong>
      <small>{priceSuffix(product.vat_rate)}</small>
    </div>
  )
}
