'use client'

import { CATALOG_TABS, type CatalogTabKey } from '@/lib/catalog-taxonomy'
import { catalogIcon } from './catalog-icons'

interface CategoryGuidesProps {
  active: CatalogTabKey
  /** Unidades disponibles por pestaña, para el contador. */
  counts: Record<string, number>
  onChange: (key: CatalogTabKey) => void
  /** Si se pasa, solo se pintan estas pestañas (wizard SaaS). */
  visibleTabs?: readonly CatalogTabKey[]
}

/**
 * Elección por necesidad, no por nombre de categoría: cada pestaña lleva un
 * icono, la familia y la frase de para qué sirve. Es la pieza más reconocible
 * del catálogo web.
 */
export default function CategoryGuides({
  active,
  counts,
  onChange,
  visibleTabs,
}: CategoryGuidesProps) {
  const tabs = visibleTabs
    ? CATALOG_TABS.filter((t) => visibleTabs.includes(t.key))
    : CATALOG_TABS

  if (tabs.length <= 1) return null

  return (
    <nav className="category-guides" aria-label="Elegir por necesidad">
      {tabs.map((tab) => {
        const Icon = catalogIcon(tab.icon)
        const isActive = active === tab.key
        const isCanarias = tab.key === 'canarias'
        return (
          <button
            key={tab.key}
            type="button"
            // Volver a pulsar la pestaña activa la deselecciona (vuelve a
            // "todo"), igual que en el catálogo web.
            onClick={() => onChange(isActive ? 'all' : tab.key)}
            aria-pressed={isActive}
            className={`${isCanarias ? 'guide-canarias ' : ''}${isActive ? 'active' : ''}`.trim()}
          >
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{tab.short}</strong>
              <small>
                {tab.prompt} · {counts[tab.key] ?? 0}
              </small>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
