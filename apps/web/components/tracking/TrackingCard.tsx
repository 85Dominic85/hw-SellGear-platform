import Link from 'next/link'
import type { TrackingEntry } from '@/lib/tracking/types'
import TipsaStatusBadge, { toneForStatus } from './TipsaStatusBadge'

const TONE_STRIPE: Record<ReturnType<typeof toneForStatus>, string> = {
  muted: 'border-t-gray-400',
  info: 'border-t-blue-500',
  ok: 'border-t-green-500',
  warn: 'border-t-amber-500',
  crit: 'border-t-red-500',
}

interface TrackingCardProps {
  entry: TrackingEntry
}

export default function TrackingCard({ entry }: TrackingCardProps) {
  const tone = toneForStatus(entry.trackingLastStatus)
  const stripeClass = TONE_STRIPE[tone]
  const age = entry.trackingLastCheckedAt
    ? relativeTime(entry.trackingLastCheckedAt)
    : null

  return (
    <Link
      href={entry.href}
      className={`block rounded-lg border border-gray-200 border-t-2 ${stripeClass} bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900`}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {entry.publicId}
        </span>
        {age && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            hace {age}
          </span>
        )}
      </div>
      <div className="mb-1 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {entry.displayName}
      </div>
      {entry.subtitle && (
        <div className="mb-2 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
          {entry.subtitle}
        </div>
      )}
      <div className="mb-2">
        <TipsaStatusBadge code={entry.trackingLastStatus} size="xs" />
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
        {entry.albaran ? (
          <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
            {entry.albaran}
          </span>
        ) : (
          <span className="text-[10px] text-gray-400">Sin albarán</span>
        )}
        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          Ver ficha ›
        </span>
      </div>
    </Link>
  )
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} d`
}
