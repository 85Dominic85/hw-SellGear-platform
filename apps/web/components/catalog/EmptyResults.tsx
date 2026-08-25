'use client'

import { Search } from 'lucide-react'

export default function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="empty-results">
      <Search size={40} aria-hidden="true" />
      <h3>No encontramos esa combinación</h3>
      <p>Prueba otra búsqueda o vuelve a mostrar todo el catálogo.</p>
      <button className="button button-secondary" type="button" onClick={onReset}>
        Ver todos los productos
      </button>
    </div>
  )
}
