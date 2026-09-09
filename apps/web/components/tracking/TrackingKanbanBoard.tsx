import type { TrackingEntry, TrackingCategory } from '@/lib/tracking/types'
import { categorize } from '@/lib/tracking/types'
import TrackingCard from './TrackingCard'

const COLUMNS: Array<{ key: TrackingCategory; title: string; dot: string }> = [
  { key: 'pending', title: 'Pendiente recogida', dot: 'bg-gray-400' },
  { key: 'transit', title: 'En tránsito', dot: 'bg-blue-500' },
  { key: 'delivered', title: 'Entregados', dot: 'bg-green-500' },
  { key: 'incident', title: 'Incidencia', dot: 'bg-amber-500' },
]

interface TrackingKanbanBoardProps {
  entries: TrackingEntry[]
}

export default function TrackingKanbanBoard({ entries }: TrackingKanbanBoardProps) {
  const grouped = new Map<TrackingCategory, TrackingEntry[]>()
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = grouped.get(col.key) ?? []
          return (
            <div key={col.key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  {col.title}
                </span>
                <span className="font-mono text-xs tabular-nums text-gray-400">
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Vacío</p>
              ) : (
                items.map((e) => <TrackingCard key={`${e.kind}:${e.id}`} entry={e} />)
              )}
            </div>
          )
        })}
      </div>

      {returned.length > 0 && (
        <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Devueltos al origen ({returned.length})
          </summary>
          <div className="grid grid-cols-1 gap-3 border-t border-gray-200 p-4 md:grid-cols-2 lg:grid-cols-4">
            {returned.map((e) => (
              <TrackingCard key={`${e.kind}:${e.id}`} entry={e} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
