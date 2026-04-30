'use client'

import type { ReactNode } from 'react'
import KpiTooltip from './KpiTooltip'

interface KpiCardProps {
  label: string
  value: string
  icon: ReactNode
  delta: number | null
  /** Texto pequeño debajo del valor (p.ej. "created → shipped"). */
  subtitle?: string
  /** Texto del tooltip al pasar por icono i. */
  tooltip?: string
  /** Badge opcional al lado del label (p.ej. "En rodaje"). */
  badge?: { label: string; tone?: 'info' | 'warning' }
  /** Color de acento para diferenciar bloques (depto vs transportista). */
  accent?: 'default' | 'depto' | 'carrier' | 'positive' | 'neutral' | 'risk'
  /** Etiqueta de la comparativa, default "vs periodo anterior". */
  deltaLabel?: string
}

const ACCENT_BORDER: Record<NonNullable<KpiCardProps['accent']>, string> = {
  default: 'border-gray-200',
  depto: 'border-blue-200 ring-1 ring-blue-100',
  carrier: 'border-amber-200 ring-1 ring-amber-100',
  positive: 'border-emerald-200 ring-1 ring-emerald-100',
  neutral: 'border-gray-200',
  risk: 'border-red-200 ring-1 ring-red-100',
}

const BADGE_TONES = {
  info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
} as const

export default function KpiCard({
  label,
  value,
  icon,
  delta,
  subtitle,
  tooltip,
  badge,
  accent = 'default',
  deltaLabel = 'vs periodo anterior',
}: KpiCardProps) {
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${ACCENT_BORDER[accent]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">{label}</span>
          {tooltip && <KpiTooltip text={tooltip} />}
          {badge && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${BADGE_TONES[badge.tone ?? 'info']}`}>
              {badge.label}
            </span>
          )}
        </div>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      {delta !== null && (
        <div className="mt-1 flex items-center gap-1">
          {delta >= 0 ? (
            <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <span className={`text-xs font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {delta >= 0 ? '+' : ''}{delta}% {deltaLabel}
          </span>
        </div>
      )}
    </div>
  )
}
