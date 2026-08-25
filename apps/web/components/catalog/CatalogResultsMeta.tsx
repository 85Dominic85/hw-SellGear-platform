'use client'

interface CatalogResultsMetaProps {
  count: number
  canReset: boolean
  onReset: () => void
}

/**
 * Recuento de resultados. Lleva `role="status"` + `aria-live` porque es lo
 * que anuncia a un lector de pantalla que la búsqueda ha cambiado el listado.
 */
export default function CatalogResultsMeta({
  count,
  canReset,
  onReset,
}: CatalogResultsMetaProps) {
  return (
    <div className="catalog-results-meta" role="status" aria-live="polite">
      <strong>
        {count} {count === 1 ? 'producto' : 'productos'}
      </strong>
      {canReset && (
        <button type="button" onClick={onReset}>
          Restablecer
        </button>
      )}
    </div>
  )
}
