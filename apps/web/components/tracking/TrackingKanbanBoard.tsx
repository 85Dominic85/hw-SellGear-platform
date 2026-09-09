import type { TrackingEntry } from '@/lib/tracking/types'
import { categorize } from '@/lib/tracking/types'
import TrackingCard from './TrackingCard'

const COLUMNS: Array<{
  key: ReturnType<typeof categorize>
  title: string
  dot: string
}> = [
  { key: 'pending', title: 'Pendiente recogida', dot: 'bg-gray-500' },
  { key: 'transit', title: 'En tránsito', dot: 'bg-blue-500' },
  { key: 'delivered', title: 'Entregados', dot: 'bg-green-500' },
  { key: 'incident', title: 'Incidencia', dot: 'bg-amber-500' },
]

interface TrackingKanbanBoardProps {
  entries: TrackingEntry[]
}

export default function TrackingKanbanBoard({ entries }: TrackingKanbanBoardProps) {
  // Categorizar solo una vez.
  const grouped = new Map<ReturnType<typeof categorize>, TrackingEntry[]>()
  for (const col of COLUMNS) grouped.set(col.key, [])
  const returned: TrackingEntry[] = []
  for (const e of entries) {
    const cat = categorize(e.trackingLastStatus)
    if (cat === 'returned') {
      returned.push(e)
      continue
    }
    grouped.get(cat)?.push(e)
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = grouped.get(col.key) ?? []
          return (
            <div
              key={col.key}
              className="flex min-h-[300px] flex-col gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/50"
            >
              <div className="mb-1 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                    {col.title}
                  </h4>
                </div>
                <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 font-mono text-[10px] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                  {items.length}
                </span>
              </div>
              {items.length === 0 ? (
                <div className="mt-3 text-center text-xs italic text-gray-400 dark:text-gray-600">
                  Vacío
                </div>
              ) : (
                items.map((e) => <TrackingCard key={`${e.kind}:${e.id}`} entry={e} />)
              )}
            </div>
          )
        })}
      </div>

      {returned.length > 0 && (
        <details className="mt-4 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50">
          <summary className="flex cursor-pointer items-center gap-2 p-3 text-xs font-semibold text-gray-700 dark:text-gray-200">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Devueltos al origen ({returned.length})
          </summary>
          <div className="grid grid-cols-1 gap-2 border-t border-gray-200 p-3 md:grid-cols-2 lg:grid-cols-4 dark:border-gray-800">
            {returned.map((e) => (
              <TrackingCard key={`${e.kind}:${e.id}`} entry={e} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
