import type { TrackingEntry } from '@/lib/tracking/types'
import TrackingTimelineRow from './TrackingTimelineRow'

/**
 * Orden: por numero de pedido, del mas alto al mas bajo.
 *
 * Los identificadores son PREFIJO-AAAAMM-SECUENCIA (HW-202609-2055 para
 * pedidos, SH-202609-0056 para envios libres). Se ordena por el AAAAMM y
 * despues por la secuencia, las dos de mayor a menor, asi que arriba queda
 * siempre el pedido mas nuevo. El prefijo no entra en la comparacion: como HW y
 * SH llevan contadores separados, ordenar la cadena entera pondria todos los SH
 * por delante de los HW solo porque la "S" va despues de la "H".
 *
 * Antes se ordenaba por la fecha del ultimo evento. No servia: el backfill toca
 * decenas de envios en el mismo minuto, con lo que la lista salia barajada.
 * Y antes de eso se ordenaba por tracking_last_checked_at, que es cuando LO
 * CONSULTAMOS NOSOTROS — un dato interno que no le dice nada a quien mira.
 *
 * Tampoco se agrupa por urgencia: hacerlo dejaba un envio de hace dos meses
 * encabezando la tabla. Las incidencias ya se distinguen con la barra ambar y
 * su badge.
 */
export function orderKey(publicId: string): number {
  const m = /(\d{6})-(\d+)/.exec(publicId)
  if (!m) return 0
  return Number(m[1]) * 100000 + Number(m[2])
}

function sortByOrderNumber(entries: TrackingEntry[]): TrackingEntry[] {
  return [...entries].sort((a, b) => {
    const diff = orderKey(b.publicId) - orderKey(a.publicId)
    if (diff !== 0) return diff
    // Desempate estable para que dos filas no bailen entre recargas.
    return b.publicId.localeCompare(a.publicId)
  })
}

interface TrackingTimelineSectionProps {
  entries: TrackingEntry[]
}

export default function TrackingTimelineSection({
  entries,
}: TrackingTimelineSectionProps) {
  const sorted = sortByOrderNumber(entries)

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
