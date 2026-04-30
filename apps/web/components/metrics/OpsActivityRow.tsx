'use client'

import KpiCard from './KpiCard'
import { calcDelta } from '@/lib/metrics'
import type { DashboardMetrics, DashboardComparison } from '@/types/metrics'

const SHIPPED_LOW_SAMPLE = 10

interface OpsActivityRowProps {
  metrics: DashboardMetrics
  comparison: DashboardComparison | null
}

export default function OpsActivityRow({ metrics, comparison }: OpsActivityRowProps) {
  const shipped = metrics.ops_total_shipped ?? 0
  const completed = metrics.ops_total_completed ?? 0
  const blocked = metrics.ops_blocked_count ?? 0

  const shippedDelta = calcDelta(shipped, comparison?.prev_ops_total_shipped ?? 0)
  const completedDelta = calcDelta(completed, comparison?.prev_ops_total_completed ?? 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard
        label="Pedidos enviados"
        value={shipped.toLocaleString('es-ES')}
        delta={shippedDelta}
        accent="depto"
        subtitle="con shipped_at en el periodo"
        tooltip="Pedidos que el departamento ha despachado fisicamente en el periodo (envios reales con etiqueta TIPSA generada). No incluye SaaS/otro."
        badge={
          shipped < SHIPPED_LOW_SAMPLE
            ? { label: 'En rodaje desde 21-abr', tone: 'info' }
            : undefined
        }
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        }
      />
      <KpiCard
        label="Pedidos completados"
        value={completed.toLocaleString('es-ES')}
        delta={completedDelta}
        accent="positive"
        subtitle="con delivered_at en el periodo"
        tooltip="Pedidos que han llegado a estado 'completado' en el periodo (no necesariamente creados aqui)."
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 13l4 4L19 7" />
          </svg>
        }
      />
      <KpiCard
        label="Pedidos bloqueados"
        value={blocked.toLocaleString('es-ES')}
        delta={null}
        accent={blocked > 0 ? 'risk' : 'neutral'}
        subtitle="creados en el periodo"
        tooltip="Pedidos parados por causas externas (legal, cliente moroso, etc.). NO penalizan a la tasa de entrega exitosa ni al SLA fisico."
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  )
}
