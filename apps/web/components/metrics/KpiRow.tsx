'use client'

import KpiCard from './KpiCard'
import { formatCurrency } from '@/lib/utils'
import { calcDelta } from '@/lib/metrics'
import type { DashboardMetrics, DashboardComparison } from '@/types/metrics'

interface KpiRowProps {
  metrics: DashboardMetrics
  comparison: DashboardComparison
}

export default function KpiRow({ metrics, comparison }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Pedidos totales"
        value={metrics.total_orders.toLocaleString('es-ES')}
        delta={calcDelta(metrics.total_orders, comparison.prev_total_orders)}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
      />
      <KpiCard
        label="Ingresos totales"
        value={formatCurrency(metrics.total_revenue)}
        delta={calcDelta(metrics.total_revenue, comparison.prev_total_revenue)}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <KpiCard
        label="Ticket medio"
        value={formatCurrency(metrics.avg_order_value)}
        delta={calcDelta(metrics.avg_order_value, comparison.prev_avg_order_value)}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        }
      />
      <KpiCard
        label="Tasa completado"
        value={`${metrics.completed_rate}%`}
        delta={calcDelta(metrics.completed_rate, comparison.prev_completed_rate)}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  )
}
