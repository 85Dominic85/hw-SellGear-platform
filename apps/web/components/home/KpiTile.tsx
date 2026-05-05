import Link from 'next/link'
import type { ReactNode } from 'react'

interface KpiTileProps {
  href: string
  label: string
  /**
   * Numero/texto accionable destacado. Ej: "12 pedidos nuevos".
   * Se muestra en grande para reducir tiempo login -> primera accion.
   */
  actionableValue: string
  /**
   * Total contextual en linea secundaria tenue. Ej: "de 67 totales".
   */
  totalValue?: string
  icon: ReactNode
  size?: 'lg' | 'md'
  className?: string
}

const SIZE_STYLES: Record<'lg' | 'md', { card: string; value: string; label: string }> = {
  lg: {
    card: 'p-6',
    value: 'text-4xl font-bold text-gray-900',
    label: 'text-base font-medium text-gray-700',
  },
  md: {
    card: 'p-5',
    value: 'text-3xl font-bold text-gray-900',
    label: 'text-sm font-medium text-gray-700',
  },
}

export default function KpiTile({
  href,
  label,
  actionableValue,
  totalValue,
  icon,
  size = 'md',
  className = '',
}: KpiTileProps) {
  const s = SIZE_STYLES[size]
  return (
    <Link
      href={href}
      className={`group block rounded-xl border border-gray-200 bg-white shadow-sm transition hover:ring-1 hover:ring-gray-400 ${s.card} ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={s.label}>{label}</span>
        <span className="text-gray-400 group-hover:text-gray-600 transition-colors">{icon}</span>
      </div>
      <p className={s.value}>{actionableValue}</p>
      {totalValue && (
        <p className="mt-1 text-xs text-gray-400">{totalValue}</p>
      )}
    </Link>
  )
}
