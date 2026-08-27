import type { Product } from '@/types/database'
import { formatCatalogPrice, priceSuffix } from '@/lib/catalog/format'
import { isFreePrice, referencePriceCents } from '@/lib/product-rules'

interface PriceTagProps {
  product: Product
  /** `detail` usa la tipografía grande de la ficha. */
  variant?: 'card' | 'detail'
}

/**
 * Precio de catálogo, o el estado "a convenir" de los productos que se
 * cotizan de cero.
 *
 * Hay tres casos, no dos:
 *   · catálogo            -> precio fijo
 *   · precio libre CON tarifa (Implementación Pro, 500 €) -> se muestra el
 *     PVP y se avisa de que la línea del pedido lo puede ajustar
 *   · precio libre SIN tarifa (Software Qamarero, SaaS + Hardware) -> el
 *     catálogo no se inventa una cifra
 *
 * El segundo caso faltaba: Implementación Pro salía como «Precio a medida» y
 * el comercial tenía que saberse la tarifa de memoria.
 */
export default function PriceTag({ product, variant = 'card' }: PriceTagProps) {
  const base = variant === 'detail' ? 'detail-price' : 'price'
  const reference = referencePriceCents(product)

  if (isFreePrice(product) && reference === null) {
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

  if (reference !== null) {
    return (
      <div className={base}>
        <strong>{formatCatalogPrice(reference)}</strong>
        <small>{priceSuffix(product.vat_rate)} · ajustable en el pedido</small>
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
