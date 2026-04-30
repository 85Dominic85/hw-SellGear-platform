'use client'

import KpiTooltip from './KpiTooltip'
import type { DashboardMetrics, SlaMetrics } from '@/types/metrics'

interface RiskRowProps {
  sla: SlaMetrics
  metrics: DashboardMetrics
}

export default function RiskRow({ sla, metrics }: RiskRowProps) {
  const excludedAdmin = metrics.ops_excluded_admin
  const hasExclusionInfo = excludedAdmin !== undefined && excludedAdmin > 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Tarjeta 1: Activos a vigilar */}
      <div
        className={`rounded-xl border p-5 shadow-sm bg-white ${
          sla.active_at_risk > 0 ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Activos a vigilar</span>
            <KpiTooltip text="Pedidos no terminales (ni 'completado' ni 'bloqueado') con mas de 5 dias desde su creacion. Suelen necesitar intervencion del depto." />
          </div>
          <span className="text-gray-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </span>
        </div>
        {sla.active_at_risk > 0 ? (
          <>
            <p className="text-2xl font-bold text-gray-900">{sla.active_at_risk}</p>
            <p className="text-xs text-gray-400 mt-0.5">&gt; 5 dias sin entregar (no bloqueados)</p>
          </>
        ) : (
          <p className="text-base font-medium text-gray-500">Sin pedidos en riesgo</p>
        )}
      </div>

      {/* Tarjeta 2: Resumen del periodo */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Resumen del periodo</span>
            <KpiTooltip text="SLA fisico: solo pedidos con envio real (excluye transferencias_saas y otro). El SLA objetivo es 7 dias entre creacion y entrega completada." />
          </div>
          <span className="text-gray-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2a4 4 0 014-4h6m0 0l-3-3m3 3l-3 3" />
            </svg>
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <div>
            <p className="text-2xl font-bold text-gray-900">{sla.total_delivered}</p>
            <p className="text-xs text-gray-400 mt-0.5">entregados</p>
          </div>
          <span className="text-sm text-gray-300">|</span>
          <div>
            <p className="text-2xl font-semibold text-amber-700">{sla.breached_count}</p>
            <p className="text-xs text-gray-400 mt-0.5">fuera de plazo SLA 7d</p>
          </div>
        </div>
        {hasExclusionInfo && (
          <p className="mt-2 text-[11px] text-gray-400 italic">
            ℹ Excluye {excludedAdmin} pedidos SaaS/otro completados en el periodo
          </p>
        )}
      </div>
    </div>
  )
}
