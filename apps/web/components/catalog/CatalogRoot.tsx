import type { ReactNode } from 'react'

interface CatalogRootProps {
  children: ReactNode
  /**
   * Activa el containment (`container-type: inline-size`) para que las
   * container queries de catalog.css respondan al ancho real del catálogo y
   * no al del viewport — el dashboard tiene un sidebar de 240px al lado.
   *
   * NO usar en modales: el containment crea contexto de posicionamiento para
   * descendientes `fixed`, así que un overlay `fixed inset-0` se quedaría
   * dentro de la caja. Los modales van por portal a <body> envueltos en
   * CatalogRoot SIN fluid.
   */
  fluid?: boolean
  className?: string
}

/**
 * Raíz del subárbol con la estética del catálogo comercial. Todas las reglas
 * de app/catalog.css están escopadas bajo `.qc`, así que sin este envoltorio
 * no se aplica ninguna — y con él no puede afectar al resto de la app.
 */
export default function CatalogRoot({
  children,
  fluid = false,
  className = '',
}: CatalogRootProps) {
  const classes = ['qc', fluid ? 'qc-fluid' : '', className]
    .filter(Boolean)
    .join(' ')
  return <div className={classes}>{children}</div>
}
