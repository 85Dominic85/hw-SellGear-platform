'use client'

import { cn } from '@/lib/utils'
import type { PeriodPreset } from '@/types/metrics'

interface PeriodSelectorProps {
  value: PeriodPreset
  customFrom: string
  customTo: string
  onChange: (preset: PeriodPreset) => void
  onCustomChange: (from: string, to: string) => void
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'this_week', label: 'Esta semana' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'last_month', label: 'Mes anterior' },
  { value: 'last_quarter', label: 'Trimestre anterior' },
  { value: 'custom', label: 'Personalizado' },
]

export default function PeriodSelector({ value, customFrom, customTo, onChange, onCustomChange }: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              value === p.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomChange(e.target.value, customTo)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-gray-400">a</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomChange(customFrom, e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
          />
        </div>
      )}
    </div>
  )
}
