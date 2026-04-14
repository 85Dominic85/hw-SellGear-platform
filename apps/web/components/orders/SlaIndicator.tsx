'use client'

import { Clock, CheckCircle2, AlertTriangle, Square } from 'lucide-react'
import {
  getDaysElapsed,
  getSlaStatus,
  getSlaColor,
  getSlaIconColor,
  formatDaysElapsed,
  getSlaLabel,
  SLA_TARGET_DAYS,
} from '@/lib/sla'
import { formatDate } from '@/lib/utils'

interface SlaIndicatorProps {
  createdAt: string
  deliveredAt?: string | null
  isTerminal: boolean
}

function SlaProgressBarLarge({ days, isTerminal }: { days: number; isTerminal: boolean }) {
  const pct = Math.min((days / SLA_TARGET_DAYS) * 100, 100)

  let barColor = 'bg-green-500'
  if (days > 6) barColor = 'bg-red-500'
  else if (days > 4) barColor = 'bg-amber-500'

  return (
    <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${barColor} ${!isTerminal && days > 0 ? 'animate-pulse' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function SlaIndicator({ createdAt, deliveredAt, isTerminal }: SlaIndicatorProps) {
  const days = getDaysElapsed(createdAt, isTerminal ? deliveredAt : undefined)
  const status = getSlaStatus(days)
  const colorClass = getSlaColor(status)
  const iconColor = getSlaIconColor(status)
  const label = getSlaLabel(status)
  const daysLabel = formatDaysElapsed(days)

  return (
    <div className={`inline-flex flex-col rounded-lg px-3 py-1.5 min-w-[140px] ${colorClass}`}>
      <div className="flex items-center gap-2">
        {/* Icono */}
        {isTerminal && deliveredAt ? (
          days <= SLA_TARGET_DAYS ? (
            <CheckCircle2 className={`h-4 w-4 ${iconColor}`} />
          ) : (
            <AlertTriangle className={`h-4 w-4 ${iconColor}`} />
          )
        ) : (
          <Clock className={`h-4 w-4 animate-pulse ${iconColor}`} />
        )}

        {/* Info */}
        <div className="flex flex-col">
          <span className="text-xs font-semibold leading-tight">
            {daysLabel} — {label}
          </span>
          <span className="text-[10px] leading-tight opacity-75">
            {isTerminal && deliveredAt
              ? `Entregado: ${formatDate(deliveredAt)}`
              : `Objetivo: ${SLA_TARGET_DAYS}d`}
          </span>
        </div>
      </div>

      {/* Barra de progreso */}
      <SlaProgressBarLarge days={days} isTerminal={isTerminal} />
    </div>
  )
}
