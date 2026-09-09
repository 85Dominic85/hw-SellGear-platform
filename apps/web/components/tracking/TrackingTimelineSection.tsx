import { categorize, type TrackingCategory } from '@/lib/tracking/types'
import type { TrackingEntry } from '@/lib/tracking/types'
import TrackingTimelineRow from './TrackingTimelineRow'

/**
 * Orden de urgencia: incidencia primero, entregados al final.
 * Dentro del mismo grupo, lo mas reciente arriba.
 *
 * Se apoya en categorize() en vez de traducir codigos por su cuenta: tener un
 * segundo mapa aqui fue justo lo que dejo esta lista ordenando al reves cuando
 * se corrigio el catalogo de TIPSA.
 */
const URGENCY_BY_CATEGORY: Record<TrackingCategory, number> = {
  incident: 0,
  returned: 1,
  pending: 2,
  transit: 3,
  delivered: 4,
}

function urgencyRank(entry: TrackingEntry): number {
  return URGENCY_BY_CATEGORY[categorize(entry.trackingLastStatus)]
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
