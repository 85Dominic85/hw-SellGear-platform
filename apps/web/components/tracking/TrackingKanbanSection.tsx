'use client'

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
    <section className="border-t border-gray-200 px-4 py-5 dark:border-gray-800">
      <details
        open={open}
        onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
        className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <svg
              className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <div>
              <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Kanban por estado
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {open
                  ? 'Agrupado por columnas · click para recoger'
                  : 'Vista agrupada · click para desplegar'}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 font-mono text-[11px] text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
            {entries.length}
          </span>
        </summary>

        {open && (
          <div className="border-t border-gray-200 p-4 dark:border-gray-800">
            <TrackingKanbanBoard entries={entries} />
          </div>
        )}
      </details>
    </section>
  )
}
