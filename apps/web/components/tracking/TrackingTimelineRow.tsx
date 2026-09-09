import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { TrackingEntry } from '@/lib/tracking/types'
import {
  resolveTimelineSteps,
  timelineProgressPct,
  type StepTone,
} from '@/lib/tracking/steps'
import TipsaStatusBadge from './TipsaStatusBadge'

/** Punto ya recorrido: relleno solido azul. */
const DONE_DOT = 'bg-blue-500 border-blue-500'
/** Punto aun no alcanzado. */
const PENDING_DOT = 'bg-white border-gray-300'

/** Punto actual: halo del color semantico del estado. */
const CURRENT_DOT: Record<StepTone, string> = {
  muted: 'bg-white border-gray-500 ring-4 ring-gray-100',
  info: 'bg-white border-blue-500 ring-4 ring-blue-100',
  ok: 'bg-green-500 border-green-500 ring-4 ring-green-100',
  warn: 'bg-white border-amber-500 ring-4 ring-amber-100',
  crit: 'bg-red-500 border-red-500 ring-4 ring-red-100',
}

/** Relleno de la barra de progreso. */
const FILL: Record<StepTone, string> = {
  muted: 'bg-gray-300',
  info: 'bg-blue-500',
  ok: 'bg-green-500',
  warn: 'bg-amber-500',
  crit: 'bg-red-500',
}

interface TrackingTimelineRowProps {
  entry: TrackingEntry
}

export default function TrackingTimelineRow({ entry }: TrackingTimelineRowProps) {
  const steps = resolveTimelineSteps(entry.events)
  const pct = timelineProgressPct(steps)
  const currentTone: StepTone = steps.find((s) => s.status === 'current')?.tone ?? 'muted'

  return (
    <Link
      href={entry.href}
      className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:ring-1 hover:ring-gray-400 md:grid-cols-[minmax(0,220px)_1fr_140px] md:items-center"
    >
      {/* Identificacion */}
      <div className="min-w-0">
        <p className="font-mono text-xs tabular-nums text-gray-500">
          {entry.publicId}
          {entry.albaran && <span className="text-gray-400"> · {entry.albaran}</span>}
        </p>
        <p className="truncate text-sm font-medium text-gray-900">{entry.displayName}</p>
        {entry.subtitle && (
          <p className="truncate text-sm text-gray-500">{entry.subtitle}</p>
        )}
      </div>

      {/* Barra de 5 pasos */}
      <div className="relative h-14 px-2">
        <div className="absolute left-2 right-2 top-[22px] h-[3px] rounded-full bg-gray-200" />
        <div
          className={cn('absolute left-2 top-[22px] h-[3px] rounded-full', FILL[currentTone])}
          style={{ width: `calc((100% - 16px) * ${pct} / 100)` }}
        />
        <div className="relative grid h-full grid-cols-5">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-center">
              <span
                className={cn(
                  'z-10 rounded-full border-2',
                  step.status === 'current'
                    ? cn('mt-[15px] h-3.5 w-3.5', CURRENT_DOT[step.tone])
                    : cn('mt-[16px] h-3 w-3', step.status === 'done' ? DONE_DOT : PENDING_DOT),
                )}
              />
              <span
                className={cn(
                  'mt-1.5 max-w-[80px] text-center text-xs',
                  step.status === 'current'
                    ? 'font-medium text-gray-900'
                    : step.status === 'done'
                      ? 'text-gray-500'
                      : 'text-gray-400',
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Estado + fecha */}
      <div className="flex flex-col items-start gap-1 md:items-end">
        <TipsaStatusBadge code={entry.trackingLastStatus} />
        {entry.trackingLastCheckedAt && (
          <span className="font-mono text-xs tabular-nums text-gray-500">
            {formatShort(entry.trackingLastCheckedAt)}
          </span>
        )}
      </div>
    </Link>
  )
}

function formatShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
