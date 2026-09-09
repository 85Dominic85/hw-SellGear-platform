import Link from 'next/link'
import type { TrackingEntry } from '@/lib/tracking/types'
import TipsaStatusBadge from './TipsaStatusBadge'

interface TrackingCardProps {
  entry: TrackingEntry
}

export default function TrackingCard({ entry }: TrackingCardProps) {
  const age = entry.trackingLastCheckedAt
    ? relativeTime(entry.trackingLastCheckedAt)
    : null

  return (
    <Link
      href={entry.href}
      className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:ring-1 hover:ring-gray-400"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-gray-500">{entry.publicId}</span>
        {age && <span className="text-xs text-gray-400">hace {age}</span>}
      </div>

      <p className="line-clamp-2 text-sm font-medium text-gray-900">
        {entry.displayName}
      </p>
      {entry.subtitle && (
        <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{entry.subtitle}</p>
      )}

      <div className="mt-3">
        <TipsaStatusBadge code={entry.trackingLastStatus} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        {entry.albaran ? (
          <span className="font-mono text-xs tabular-nums text-gray-400">
            {entry.albaran}
          </span>
        ) : (
          <span className="text-xs text-gray-400">Sin albarán</span>
        )}
        <span className="text-xs font-medium text-brand">Ver ficha →</span>
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
