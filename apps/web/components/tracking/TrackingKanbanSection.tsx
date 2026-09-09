'use client'

import { cn } from '@/lib/utils'
import type { TrackingEntry } from '@/lib/tracking/types'
import TrackingKanbanBoard from './TrackingKanbanBoard'

interface TrackingKanbanSectionProps {
  entries: TrackingEntry[]
  open: boolean
  onToggle: (open: boolean) => void
}

export default function TrackingKanbanSection({
  entries,
  open,
  onToggle,
}: TrackingKanbanSectionProps) {
  return (
    <section>
      <button
        type="button"
        onClick={() => onToggle(!open)}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <svg
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition-transform',
            open && 'rotate-90',
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Agrupado por estado
        </h2>
        <span className="font-mono text-xs tabular-nums text-gray-400">
          {entries.length}
        </span>
        <span className="ml-auto text-xs text-gray-400">
          {open ? 'Ocultar' : 'Mostrar'}
        </span>
      </button>

      {open && <TrackingKanbanBoard entries={entries} />}
    </section>
  )
}
