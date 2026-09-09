import type { TrackingEntry } from '@/lib/tracking/types'
import TrackingTimelineRow from './TrackingTimelineRow'

/**
 * Orden de urgencia: incidencia primero, entregados al final.
 * Dentro del mismo grupo, lo mas reciente arriba.
 */
function urgencyRank(entry: TrackingEntry): number {
  const code = entry.trackingLastStatus ?? ''
  if (code === '3') return 0 // incidencia real
  if (code === '6') return 1 // devuelto
  if (!code || code === '0' || code === '1') return 2 // sin recogida
  if (code === '2') return 4 // entregado
  return 3 // en transito
}

function sortByUrgency(entries: TrackingEntry[]): TrackingEntry[] {
  return [...entries].sort((a, b) => {
    const ra = urgencyRank(a)
    const rb = urgencyRank(b)
    if (ra !== rb) return ra - rb
    const ta = a.trackingLastCheckedAt ? new Date(a.trackingLastCheckedAt).getTime() : 0
    const tb = b.trackingLastCheckedAt ? new Date(b.trackingLastCheckedAt).getTime() : 0
    return tb - ta
  })
}

interface TrackingTimelineSectionProps {
  entries: TrackingEntry[]
}

export default function TrackingTimelineSection({
  entries,
}: TrackingTimelineSectionProps) {
  const sorted = sortByUrgency(entries)

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Seguimiento de envíos
        </h2>
        <span className="font-mono text-xs tabular-nums text-gray-400">
          {sorted.length} {sorted.length === 1 ? 'envío' : 'envíos'}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">
            No hay envíos que coincidan con los filtros actuales.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((e) => (
            <TrackingTimelineRow key={`${e.kind}:${e.id}`} entry={e} />
          ))}
        </div>
      )}
    </section>
  )
}
