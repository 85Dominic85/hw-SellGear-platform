import type { TrackingEntry } from '@/lib/tracking/types'
import TrackingTimelineRow from './TrackingTimelineRow'

/**
 * Orden de urgencia visual: incidencia > sin recogida antigua > tránsito
 * reciente > entregado hoy. Simple heurística — el estado oficial (badge)
 * ya distingue el resto.
 */
function urgencyRank(entry: TrackingEntry): number {
  const code = entry.trackingLastStatus ?? ''
  if (code === '3') return 0 // incidencia real
  if (code === '6') return 1 // devuelto
  if (!code || code === '0' || code === '1') return 2 // sin recogida
  if (code === '2') return 4 // entregado (al final del listado)
  return 3 // en tránsito
}

function sortByUrgency(entries: TrackingEntry[]): TrackingEntry[] {
  return [...entries].sort((a, b) => {
    const ra = urgencyRank(a)
    const rb = urgencyRank(b)
    if (ra !== rb) return ra - rb
    // Dentro de la misma urgencia, más reciente primero.
    const ta = a.trackingLastCheckedAt ? new Date(a.trackingLastCheckedAt).getTime() : 0
    const tb = b.trackingLastCheckedAt ? new Date(b.trackingLastCheckedAt).getTime() : 0
    return tb - ta
  })
}

interface TrackingTimelineSectionProps {
  entries: TrackingEntry[]
}

export default function TrackingTimelineSection({ entries }: TrackingTimelineSectionProps) {
  const sorted = sortByUrgency(entries)

  return (
    <section className="px-4 py-5">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Seguimiento de envíos
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Progreso de cada envío por el flujo TIPSA · ordenado por urgencia
          </p>
        </div>
        <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 font-mono text-[11px] text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          {sorted.length} envíos
        </span>
      </header>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
          No hay envíos que coincidan con los filtros actuales.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((e) => (
            <TrackingTimelineRow key={`${e.kind}:${e.id}`} entry={e} />
          ))}
        </div>
      )}
    </section>
  )
}
