import Link from 'next/link'
import { PURCHASE_TYPE_LABELS } from '@/lib/utils'
import type { PurchaseType } from '@/types/database'

interface CategoryTileProps {
  type: PurchaseType
  total: number
  nuevo: number
}

// Iconos por categoria. Duplicados del SidebarNav para no acoplar componentes.
const CATEGORY_ICONS: Record<PurchaseType, React.ReactNode> = {
  kit_digital: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  hardware_one_off: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  hardware_financiacion: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  transferencias_saas: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  // SaaS + Hardware: capas apiladas (representa software + equipos combinados)
  saas_hardware: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6" />
    </svg>
  ),
  otro: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  ),
}

export default function CategoryTile({ type, total, nuevo }: CategoryTileProps) {
  const label = PURCHASE_TYPE_LABELS[type] ?? type
  const isEmpty = nuevo === 0

  return (
    <Link
      href={`/orders?type=${type}`}
      className={`group block rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:ring-1 hover:ring-gray-400 ${
        isEmpty ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-400 group-hover:text-gray-600 transition-colors">
          {CATEGORY_ICONS[type]}
        </span>
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {label}
        </span>
      </div>
      {isEmpty ? (
        <>
          <p className="text-base font-medium text-gray-500">Sin pedidos nuevos</p>
          <p className="mt-0.5 text-xs text-gray-400">{total} totales</p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold text-gray-900">
            {nuevo} {nuevo === 1 ? 'nuevo' : 'nuevos'}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">de {total} totales</p>
        </>
      )}
    </Link>
  )
}
