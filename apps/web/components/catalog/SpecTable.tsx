import type { ProductSpec } from '@/types/database'

/**
 * Tabla de especificaciones. Se guardan como ARRAY (no como objeto) porque el
 * orden es curado — Pantalla, Procesador, Memoria… — y un objeto jsonb no
 * preserva el orden de claves.
 */
export default function SpecTable({ specs }: { specs: ProductSpec[] }) {
  if (!specs.length) return null
  return (
    <dl className="spec-table">
      {specs.map((s) => (
        <div key={s.label}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  )
}
