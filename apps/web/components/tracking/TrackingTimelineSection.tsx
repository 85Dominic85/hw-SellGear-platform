import type { TrackingEntry } from '@/lib/tracking/types'
import TrackingTimelineRow from './TrackingTimelineRow'

/**
 * Orden: lo mas reciente arriba.
 *
 * La "recencia" de un envio es la fecha de su ultimo evento real, con
 * `shippedAt` de reserva para los que aun no tienen historial de TIPSA. NO se
 * usa `trackingLastCheckedAt`: eso es cuando LO CONSULTAMOS NOSOTROS, no cuando
 * paso algo, y ordenar por ahi mezclaba envios de julio con los de esta semana
 * sin ningun criterio visible para quien mira la lista.
 *
 * Tampoco se agrupa por urgencia. Se probo poner las incidencias primero y el
 * efecto era que un envio de hace dos meses encabezaba la tabla. Las
 * incidencias ya se distinguen solas: barra ambar y badge propio.
 */
function recencyOf(entry: TrackingEntry): number {
  let last = 0
  for (const ev of entry.events) {
    const t = new Date(ev.event_date).getTime()
    if (Number.isFinite(t) && t > last) last = t
  }
  if (last > 0) return last
  const fallback = entry.shippedAt ?? entry.trackingLastCheckedAt
  const t = fallback ? new Date(fallback).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

function sortByRecency(entries: TrackingEntry[]): TrackingEntry[] {
  return [...entries].sort((a, b) => {
    const diff = recencyOf(b) - recencyOf(a)
    if (diff !== 0) return diff
    // Desempate estable por identificador para que dos envios del mismo
    // momento no bailen entre recargas.
    return b.publicId.localeCompare(a.publicId)
  })
}

interface TrackingTimelineSectionProps {
  entries: TrackingEntry[]
}

export default function TrackingTimelineSection({
  entries,
}: TrackingTimelineSectionProps) {
  const sorted = sortByRecency(entries)

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
