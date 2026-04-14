'use client'

import KpiCard from './KpiCard'
import type { SlaMetrics } from '@/types/metrics'

interface SlaKpiRowProps {
  sla: SlaMetrics
}

export default function SlaKpiRow({ sla }: SlaKpiRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard
        label="Plazo medio entrega"
        value={`${sla.avg_delivery_days}d`}
        delta={null}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <KpiCard
        label="Cumplimiento SLA (7d)"
        value={`${sla.on_time_pct}%`}
        delta={null}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
      />
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">Pedidos en riesgo</span>
          <span className="text-gray-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <p className="text-2xl font-bold text-gray-900">{sla.active_at_risk}</p>
          <span className="text-sm text-gray-400">|</span>
          <p className="text-base font-semibold text-gray-500">
            {sla.breached_count}
            <span className="text-xs font-normal text-gray-400 ml-1">fuera de plazo</span>
          </p>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs text-gray-400">
            {sla.total_delivered} entregados en el periodo
          </span>
        </div>
      </div>
    </div>
  )
}
