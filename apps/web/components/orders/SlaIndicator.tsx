'use client'

import { Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
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

export default function SlaIndicator({ createdAt, deliveredAt, isTerminal }: SlaIndicatorProps) {
  const days = getDaysElapsed(createdAt, isTerminal ? deliveredAt : undefined)
  const status = getSlaStatus(days)
  const colorClass = getSlaColor(status)
  const iconColor = getSlaIconColor(status)
  const label = getSlaLabel(status)
  const daysLabel = formatDaysElapsed(days)

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${colorClass}`}>
      {/* Icono */}
      {isTerminal && deliveredAt ? (
        days <= SLA_TARGET_DAYS ? (
          <CheckCircle2 className={`h-4 w-4 ${iconColor}`} />
        ) : (
          <AlertTriangle className={`h-4 w-4 ${iconColor}`} />
        )
      ) : (
        <Clock className={`h-4 w-4 ${iconColor}`} />
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
  )
}
