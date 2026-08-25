import type { ReactNode } from 'react'

/** Rejilla 3/2/1 columnas según el ancho del contenedor (no del viewport). */
export default function ProductGrid({ children }: { children: ReactNode }) {
  return <div className="product-grid">{children}</div>
}
