'use client'

import { Search, SlidersHorizontal, X } from 'lucide-react'

export type CatalogSort = 'recommended' | 'price-asc' | 'price-desc' | 'name'

interface CatalogToolbarProps {
  query: string
  onQueryChange: (value: string) => void
  sort: CatalogSort
  onSortChange: (value: CatalogSort) => void
}

export default function CatalogToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
}: CatalogToolbarProps) {
  return (
    <div className="catalog-toolbar">
      <label className="search-field">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">Buscar en el catálogo</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Busca por uso, equipo o marca..."
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Borrar búsqueda"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </label>

      <label className="sort-field">
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span className="sr-only">Ordenar productos</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as CatalogSort)}
        >
          <option value="recommended">Recomendados</option>
          <option value="price-asc">Precio: menor a mayor</option>
          <option value="price-desc">Precio: mayor a menor</option>
          <option value="name">Nombre</option>
        </select>
      </label>
    </div>
  )
}
