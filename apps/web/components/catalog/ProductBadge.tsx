interface ProductBadgeProps {
  label: string
  /** `detail` lo reposiciona para la ficha (imagen más grande). */
  variant?: 'card' | 'detail'
}

/** Etiqueta comercial de la esquina: Popular, Recomendado, Premium... */
export default function ProductBadge({
  label,
  variant = 'card',
}: ProductBadgeProps) {
  return (
    <span
      className={
        variant === 'detail' ? 'product-badge detail-badge' : 'product-badge'
      }
    >
      {label}
    </span>
  )
}
