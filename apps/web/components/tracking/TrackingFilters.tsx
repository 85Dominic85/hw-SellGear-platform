'use client'

/**
 * Filtros compartidos entre Timeline y Kanban.
 * Estado controlado desde el padre (TrackingBoard) para que ambas secciones
 * vean el mismo subconjunto sin re-fetch.
 */

export type DateRange = '7d' | '30d' | '90d' | 'active'
export type KindFilter = 'all' | 'orders' | 'shipments'

export interface FiltersState {
  range: DateRange
  onlyMine: boolean
  kind: KindFilter
}

interface TrackingFiltersProps {
  value: FiltersState
  onChange: (next: FiltersState) => void
  liveHint?: string
}

const RANGE_OPTIONS: Array<{ value: DateRange; label: string }> = [
  { value: 'active', label: 'Activos' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
]

export default function TrackingFilters({ value, onChange, liveHint }: TrackingFiltersProps) {
  const set = <K extends keyof FiltersState>(k: K, v: FiltersState[K]) =>
    onChange({ ...value, [k]: v })

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      {/* Range */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-950">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => set('range', opt.value)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              value.range === opt.value
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Kind */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-950">
        {(
          [
            { v: 'all' as const, l: 'Todo' },
            { v: 'orders' as const, l: 'Pedidos' },
            { v: 'shipments' as const, l: 'Envíos libres' },
          ] satisfies Array<{ v: KindFilter; l: string }>
        ).map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => set('kind', opt.v)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              value.kind === opt.v
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {/* Solo mios */}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <input
          type="checkbox"
          checked={value.onlyMine}
          onChange={(e) => set('onlyMine', e.target.checked)}
          className="h-3 w-3"
        />
        Solo míos
      </label>

      {liveHint && (
        <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          {liveHint}
        </span>
      )}
    </div>
  )
}
