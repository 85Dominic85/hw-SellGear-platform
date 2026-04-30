'use client'

import KpiCard from './KpiCard'
import { calcDelta } from '@/lib/metrics'
import type { DashboardMetrics, DashboardComparison } from '@/types/metrics'

interface ProcessTimingRowProps {
  metrics: DashboardMetrics
  comparison: DashboardComparison | null
}

export default function ProcessTimingRow({ metrics, comparison }: ProcessTimingRowProps) {
  const handling = metrics.ops_avg_handling_days ?? 0
  const transit = metrics.ops_avg_transit_days ?? 0
  const onTimeShipping = metrics.ops_on_time_shipping_pct ?? 0

  // Para handling, "menos es mejor" → invertimos el signo del delta.
  const prevHandling = comparison?.prev_ops_avg_handling_days
  const handlingDeltaRaw =
    prevHandling !== undefined ? calcDelta(handling, prevHandling) : null
  const handlingDelta = handlingDeltaRaw !== null ? -handlingDeltaRaw : null

  const onTimeDelta = calcDelta(
    onTimeShipping,
    comparison?.prev_ops_on_time_shipping_pct ?? 0,
  )

  const sample = metrics.ops_total_shipped ?? 0
  const lowSample = sample < 10

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard
        label="Plazo manipulacion"
        value={`${handling}d`}
        delta={handlingDelta}
        deltaLabel="mejora vs anterior"
        accent="depto"
        subtitle="created → shipped (lo que controla el depto)"
        tooltip="Tiempo medio entre que llega el pedido y el departamento despacha el envio fisico. Excluye transferencias_saas y otro."
        badge={lowSample ? { label: 'Muestra pequeña', tone: 'info' } : undefined}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v3a1 1 0 01-.293.707L15 13.414V19a1 1 0 01-.293.707l-2 2A1 1 0 0111 21v-7.586L3.293 7.707A1 1 0 013 7V4z" />
          </svg>
        }
      />
      <KpiCard
        label="Plazo transporte"
        value={`${transit}d`}
        delta={null}
        accent="carrier"
        subtitle="shipped → delivered (transportista)"
        tooltip="Tiempo medio que tarda el transportista (TIPSA u otro) entre que recoge el envio y se confirma la entrega. NO depende del departamento."
        badge={lowSample ? { label: 'Muestra pequeña', tone: 'info' } : undefined}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 011 1h2m-9 0h6m4 0h2a1 1 0 001-1v-5a1 1 0 00-.293-.707L17 9V6a1 1 0 00-1-1h-3" />
          </svg>
        }
      />
      <KpiCard
        label="Cumplimiento envio 5d"
        value={`${onTimeShipping}%`}
        delta={onTimeDelta}
        accent="depto"
        subtitle="% envios despachados en ≤ 5 dias"
        tooltip="Porcentaje de envios fisicos que el departamento ha despachado en 5 dias o menos desde la creacion del pedido. Solo cuenta envios fisicos (excluye SaaS/otro)."
        badge={lowSample ? { label: 'Muestra pequeña', tone: 'info' } : undefined}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      />
    </div>
  )
}
