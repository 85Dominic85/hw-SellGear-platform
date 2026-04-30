'use client'

import KpiCard from './KpiCard'
import { formatCurrency } from '@/lib/utils'
import { calcDelta } from '@/lib/metrics'
import type { DashboardMetrics, DashboardComparison } from '@/types/metrics'

interface KpiRowProps {
  metrics: DashboardMetrics
  comparison: DashboardComparison | null
}

export default function KpiRow({ metrics, comparison }: KpiRowProps) {
  const revenueDelta = calcDelta(metrics.total_revenue, comparison?.prev_total_revenue ?? 0)
  const ticketDelta = calcDelta(metrics.avg_order_value, comparison?.prev_avg_order_value ?? 0)
  const ordersDelta = calcDelta(metrics.total_orders, comparison?.prev_total_orders ?? 0)
  const completedDelta = calcDelta(metrics.completed_rate, comparison?.prev_completed_rate ?? 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard
        label="Pedidos totales"
        value={metrics.total_orders.toLocaleString('es-ES')}
        delta={ordersDelta}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
      />
      {/* Tarjeta combinada: Ingresos totales + Ticket medio */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">Ingresos / Ticket medio</span>
          <span className="text-gray-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.total_revenue)}</p>
          <span className="text-sm text-gray-400">|</span>
          <p className="text-base font-semibold text-gray-500">{formatCurrency(metrics.avg_order_value)}<span className="text-xs font-normal text-gray-400 ml-1">/ pedido</span></p>
        </div>
        <div className="mt-1 flex items-center gap-3">
          {revenueDelta !== null && (
            <DeltaBadge delta={revenueDelta} label="ingresos" />
          )}
          {ticketDelta !== null && (
            <DeltaBadge delta={ticketDelta} label="ticket" />
          )}
        </div>
      </div>
      <KpiCard
        label="Tasa entrega exitosa"
        value={`${metrics.completed_rate.toFixed(1)}%`}
        delta={completedDelta}
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

function DeltaBadge({ delta, label }: { delta: number; label: string }) {
  const positive = delta >= 0
  return (
    <div className="flex items-center gap-0.5">
      {positive ? (
        <svg className="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      )}
      <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
        {positive ? '+' : ''}{delta}% {label}
      </span>
    </div>
  )
}
