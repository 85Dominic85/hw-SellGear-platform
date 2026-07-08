'use client'

import { Clock, CheckCircle2, AlertTriangle, PauseCircle } from 'lucide-react'
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
import type { OrderStatus } from '@/types/database'

interface SlaIndicatorProps {
  createdAt: string
  deliveredAt?: string | null
  /** Terminal exitoso (completado / pagado con delivered_at). */
  isTerminal: boolean
  /** Estado actual del pedido; si es 'bloqueado' pausamos el reloj. */
  status?: OrderStatus | null
  /** Timestamp de la ultima modificacion. Cuando el pedido entra en
   *  estado bloqueado el updated_at cambia; lo usamos como aproximacion
   *  del momento en que empezo la pausa (sin necesidad de una columna
   *  blocked_at ni de leer status_history). */
  updatedAt?: string | null
}

function SlaProgressBarLarge({
  days,
  animated,
  frozen,
}: {
  days: number
  animated: boolean
  frozen: boolean
}) {
  const pct = Math.min((days / SLA_TARGET_DAYS) * 100, 100)

  let barColor = 'bg-green-500'
  if (frozen) barColor = 'bg-gray-400'
  else if (days > 6) barColor = 'bg-red-500'
  else if (days > 4) barColor = 'bg-amber-500'

  return (
    <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${barColor} ${animated ? 'animate-pulse' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function SlaIndicator({
  createdAt,
  deliveredAt,
  isTerminal,
  status,
  updatedAt,
}: SlaIndicatorProps) {
  const isPaused = status === 'bloqueado'
  // Si esta pausado, el reloj se congela en updatedAt (aprox. del momento
  // en que entro en bloqueado). Si esta entregado, usa deliveredAt. Si no,
  // reloj activo (Date.now()).
  const pausedAt = isPaused ? updatedAt ?? null : null
  const days = getDaysElapsed(
    createdAt,
    isTerminal ? deliveredAt : undefined,
    pausedAt,
  )
  // Si esta pausado, el status del SLA es 'paused' (badge gris) sin importar
  // los dias. En otro caso, seguimos con la matriz on_track/warning/breached.
  const slaStatus = isPaused ? 'paused' : getSlaStatus(days)
  const colorClass = getSlaColor(slaStatus)
  const iconColor = getSlaIconColor(slaStatus)
  const label = getSlaLabel(slaStatus)
  const daysLabel = formatDaysElapsed(days)

  return (
    <div className={`inline-flex flex-col rounded-lg px-3 py-1.5 min-w-[140px] ${colorClass}`}>
      <div className="flex items-center gap-2">
        {/* Icono */}
        {isPaused ? (
          <PauseCircle className={`h-4 w-4 ${iconColor}`} />
        ) : isTerminal && deliveredAt ? (
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
            {isPaused
              ? 'Reloj pausado'
              : isTerminal && deliveredAt
                ? `Entregado: ${formatDate(deliveredAt)}`
                : `Objetivo: ${SLA_TARGET_DAYS}d`}
          </span>
        </div>
      </div>

      {/* Barra de progreso — animada solo cuando el reloj esta activo. */}
      <SlaProgressBarLarge
        days={days}
        animated={!isTerminal && !isPaused && days > 0}
        frozen={isPaused}
      />
    </div>
  )
}
