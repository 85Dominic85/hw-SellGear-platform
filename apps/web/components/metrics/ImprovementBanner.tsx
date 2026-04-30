'use client'

import { calcDelta } from '@/lib/metrics'
import type { DashboardMetrics, DashboardComparison } from '@/types/metrics'

const SHIPPED_DELTA_THRESHOLD = 5

interface ImprovementBannerProps {
  metrics: DashboardMetrics
  comparison: DashboardComparison | null
}

export default function ImprovementBanner({ metrics, comparison }: ImprovementBannerProps) {
  if (!comparison) return null
  const current = metrics.ops_total_shipped
  const previous = comparison.prev_ops_total_shipped
  if (current === undefined || previous === undefined) return null

  const delta = calcDelta(current, previous)
  if (delta === null || delta < SHIPPED_DELTA_THRESHOLD) return null

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
        <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-emerald-900">
          +{delta}% pedidos enviados vs periodo anterior
        </p>
        <p className="text-xs text-emerald-700">
          {current} envios fisicos en este periodo · {previous} en el anterior
        </p>
      </div>
    </div>
  )
}
