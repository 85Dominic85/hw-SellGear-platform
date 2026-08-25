import type { Product } from '@/types/database'
import { formatCatalogPrice } from '@/lib/catalog/format'
import { packSavingCents, standalonePriceCents } from '@/lib/product-rules'

interface PackComparisonProps {
  product: Product
  /** `detail` muestra además el desglose línea a línea. */
  variant?: 'card' | 'detail'
}

/**
 * "Por separado: 599 € / Ahorras 100 €". Es el argumento comercial más
 * fuerte del catálogo: compara el precio del pack con la suma de sus
 * componentes comprados por separado.
 *
 * El ahorro puede ser NEGATIVO: hay packs donde la preconfiguración añade
 * coste, y entonces el mensaje se invierte a "Preconfigurado: +X €" — igual
 * que en el catálogo web, sin fingir un ahorro que no existe.
 */
export default function PackComparison({
  product,
  variant = 'card',
}: PackComparisonProps) {
  const standalone = standalonePriceCents(product)
  if (standalone === null) return null

  const saving = packSavingCents(product)
  const hasSaving = saving !== null && saving > 0
  const breakdown = product.price_breakdown ?? []

  const classes = [
    'pack-comparison',
    hasSaving ? 'saving' : '',
    variant === 'detail' ? 'detail-pack-comparison' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <span>Por separado: {formatCatalogPrice(standalone)}</span>
      <strong>
        {hasSaving
          ? `Ahorras ${formatCatalogPrice(saving!)}`
          : `Preconfigurado: +${formatCatalogPrice(Math.abs(saving ?? 0))}`}
      </strong>

      {variant === 'detail' && breakdown.length > 0 && (
        <ul className="pack-price-breakdown">
          {breakdown.map((item) => (
            <li key={item.label}>
              <span>
                {item.label}
                {item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ''}
              </span>
              <b>
                {formatCatalogPrice(item.price_cents * (item.quantity ?? 1))}
              </b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
