import Link from 'next/link'
import type { TrackingEntry } from '@/lib/tracking/types'
import {
  resolveTimelineSteps,
  timelineProgressPct,
  type StepTone,
} from '@/lib/tracking/steps'
import TipsaStatusBadge from './TipsaStatusBadge'

const DOT_CLASSES: Record<StepTone, string> = {
  muted: 'bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700',
  info: 'bg-blue-500 border-blue-500',
  ok: 'bg-green-500 border-green-500 ring-4 ring-green-100 dark:ring-green-950',
  warn: 'bg-white border-amber-500 ring-4 ring-amber-100 dark:bg-gray-900 dark:ring-amber-950',
  crit: 'bg-red-500 border-red-500 ring-4 ring-red-100 dark:ring-red-950',
}

const CURRENT_DOT_CLASSES: Record<StepTone, string> = {
  muted: 'bg-white border-gray-500 dark:bg-gray-900',
  info: 'bg-white border-blue-500 ring-4 ring-blue-100 dark:bg-gray-900 dark:ring-blue-950',
  ok: 'bg-green-500 border-green-500 ring-4 ring-green-100 dark:ring-green-950',
  warn: 'bg-white border-amber-500 ring-4 ring-amber-100 dark:bg-gray-900 dark:ring-amber-950',
  crit: 'bg-red-500 border-red-500 ring-4 ring-red-100 dark:ring-red-950',
}

const FILL_CLASSES: Record<StepTone, string> = {
  muted: 'bg-gray-300 dark:bg-gray-700',
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
  const current = steps.find((s) => s.status === 'current')
  const currentTone: StepTone = current?.tone ?? 'muted'

  return (
    <Link
      href={entry.href}
      className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md md:grid-cols-[220px_1fr_140px] md:items-center dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Izquierda: identificación */}
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
          {entry.publicId}
          {entry.albaran && (
            <span className="ml-2 text-gray-400 dark:text-gray-500">· {entry.albaran}</span>
          )}
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {entry.displayName}
        </span>
        {entry.subtitle && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {entry.subtitle}
          </span>
        )}
      </div>

      {/* Centro: barra de progreso 5 pasos */}
      <div className="relative h-14 px-2">
        {/* Linea base gris */}
        <div className="absolute left-2 right-2 top-[22px] h-[3px] rounded-full bg-gray-200 dark:bg-gray-700" />
        {/* Fill de progreso */}
        <div
          className={`absolute left-2 top-[22px] h-[3px] rounded-full ${FILL_CLASSES[currentTone]}`}
          style={{ width: `calc((100% - 16px) * ${pct} / 100)` }}
        />
        {/* Puntos */}
        <div className="relative grid h-full grid-cols-5">
          {steps.map((step, i) => {
            const cls =
              step.status === 'current'
                ? CURRENT_DOT_CLASSES[step.tone]
                : step.status === 'done'
                  ? DOT_CLASSES.info
                  : DOT_CLASSES.muted
            const labelCls =
              step.status === 'current'
                ? 'text-gray-900 font-semibold dark:text-gray-100'
                : step.status === 'done'
                  ? 'text-gray-600 dark:text-gray-400'
                  : 'text-gray-400 dark:text-gray-600'
            const dotSize = step.status === 'current' ? 'h-3.5 w-3.5' : 'h-3 w-3'
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className={`z-10 mt-[15px] rounded-full border-2 ${dotSize} ${cls}`}
                />
                <span
                  className={`mt-1 max-w-[80px] text-center text-[10px] uppercase tracking-wide ${labelCls}`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Derecha: badge estado + fecha */}
      <div className="flex flex-col items-start gap-1 md:items-end">
        <TipsaStatusBadge code={entry.trackingLastStatus} size="sm" />
        {entry.trackingLastCheckedAt && (
          <span className="font-mono text-[11px] text-gray-500 tabular-nums dark:text-gray-400">
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
