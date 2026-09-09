'use client'

import { cn } from '@/lib/utils'

/**
 * Filtros compartidos entre timeline y kanban.
 * Estado controlado desde TrackingBoard para que ambas secciones
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
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
]

const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'orders', label: 'Pedidos' },
  { value: 'shipments', label: 'Envíos libres' },
]

function SegmentedGroup<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onSelect: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function TrackingFilters({
  value,
  onChange,
  liveHint,
}: TrackingFiltersProps) {
  const set = <K extends keyof FiltersState>(k: K, v: FiltersState[K]) =>
    onChange({ ...value, [k]: v })

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <SegmentedGroup
        options={RANGE_OPTIONS}
        value={value.range}
        onSelect={(v) => set('range', v)}
      />
      <SegmentedGroup
        options={KIND_OPTIONS}
        value={value.kind}
        onSelect={(v) => set('kind', v)}
      />

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
        <input
          type="checkbox"
          checked={value.onlyMine}
          onChange={(e) => set('onlyMine', e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand"
        />
        Solo míos
      </label>

      {liveHint && (
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-gray-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          {liveHint}
        </span>
      )}
    </div>
  )
}
