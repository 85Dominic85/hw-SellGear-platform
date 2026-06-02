'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDateRange } from '@/lib/metrics'
import type { DashboardMetrics, DashboardComparison, SlaMetrics, PeriodPreset, RequesterRankingRow } from '@/types/metrics'
import type { PurchaseType } from '@/types/database'
import KpiRow from './KpiRow'
import SlaKpiRow from './SlaKpiRow'
import SlaChart from './SlaChart'
import PeriodSelector from './PeriodSelector'
import PurchaseTypeFilter from './PurchaseTypeFilter'
import ExportButton from './ExportButton'
import OrdersTimeChart from './OrdersTimeChart'
import PurchaseTypeChart from './PurchaseTypeChart'
import ProductBreakdown from './ProductBreakdown'
import StatusDistChart from './StatusDistChart'
import OpsActivityRow from './OpsActivityRow'
import ProcessTimingRow from './ProcessTimingRow'
import RiskRow from './RiskRow'
import ThroughputChart from './ThroughputChart'
import ImprovementBanner from './ImprovementBanner'
import RequesterPodium from './RequesterPodium'

const METRICS_V2 = process.env.NEXT_PUBLIC_METRICS_V2 === '1'

const DEFAULT_SLA: SlaMetrics = {
  total_delivered: 0,
  avg_delivery_days: 0,
  on_time_pct: 0,
  breached_count: 0,
  active_at_risk: 0,
  sla_by_week: [],
}

interface MetricsDashboardProps {
  initialMetrics: DashboardMetrics
  initialComparison: DashboardComparison | null
  initialSla?: SlaMetrics
  initialRanking?: RequesterRankingRow[]
}

export default function MetricsDashboard({
  initialMetrics,
  initialComparison,
  initialSla,
  initialRanking,
}: MetricsDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics)
  const [comparison, setComparison] = useState<DashboardComparison | null>(initialComparison)
  const [sla, setSla] = useState<SlaMetrics>(initialSla ?? DEFAULT_SLA)
  const [ranking, setRanking] = useState<RequesterRankingRow[]>(initialRanking ?? [])
  const [loading, setLoading] = useState(false)
  const [preset, setPreset] = useState<PeriodPreset>('this_month')
  const [purchaseType, setPurchaseType] = useState<PurchaseType | 'all'>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const fetchMetrics = useCallback(async (from: string, to: string, type: PurchaseType | 'all') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (type !== 'all') params.set('purchase_type', type)
      const res = await fetch(`/api/metrics?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        console.error('Metrics fetch failed:', res.status, await res.text())
        return
      }
      const data = await res.json()
      setMetrics(data.metrics)
      setComparison(data.comparison ?? null)
      if (data.sla) setSla(data.sla)
      setRanking(data.ranking ?? [])
    } catch (err) {
      console.error('Metrics fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const getRange = useCallback(() => {
    if (preset === 'custom' && customFrom && customTo) {
      return {
        from: new Date(customFrom).toISOString(),
        to: new Date(customTo + 'T23:59:59').toISOString(),
      }
    }
    return getDateRange(preset)
  }, [preset, customFrom, customTo])

  useEffect(() => {
    // Skip fetch on initial mount (we have server-side data)
    const range = getRange()
    fetchMetrics(range.from, range.to, purchaseType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, purchaseType, customFrom, customTo])

  const handlePresetChange = (newPreset: PeriodPreset) => {
    if (newPreset === 'custom' && !customFrom && !customTo) {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      setCustomFrom(firstDay.toISOString().split('T')[0])
      setCustomTo(now.toISOString().split('T')[0])
    }
    setPreset(newPreset)
  }

  const handleCustomChange = (from: string, to: string) => {
    setCustomFrom(from)
    setCustomTo(to)
  }

  const range = getRange()

  return (
    <div className={`space-y-6 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Header con filtros */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:flex-row">
        <h1 className="text-2xl font-bold text-gray-900">Metricas</h1>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <PurchaseTypeFilter value={purchaseType} onChange={setPurchaseType} />
          <ExportButton from={range.from} to={range.to} purchaseType={purchaseType} />
        </div>
      </div>

      {/* Period selector */}
      <div className="print:hidden">
        <PeriodSelector
          value={preset}
          customFrom={customFrom}
          customTo={customTo}
          onChange={handlePresetChange}
          onCustomChange={handleCustomChange}
        />
      </div>

      {METRICS_V2 ? (
        <>
          {/* Banner condicional cuando hay mejora vs periodo anterior */}
          <ImprovementBanner metrics={metrics} comparison={comparison} />

          {/* Seccion 1: ACTIVIDAD OPERATIVA del depto */}
          <SectionHeader title="Actividad operativa" subtitle="Lo que el departamento ha procesado en el periodo" />
          <OpsActivityRow metrics={metrics} comparison={comparison} />

          {/* Seccion 2: TIEMPOS DE PROCESO (separa fisico/admin) */}
          <SectionHeader title="Tiempos de proceso" subtitle="Distincion entre lo que controla el depto y lo que depende del transportista" />
          <ProcessTimingRow metrics={metrics} comparison={comparison} />

          {/* Seccion 3: NEGOCIO (KPIs financieros) */}
          <SectionHeader title="Negocio" subtitle="Volumen y facturacion del periodo" />
          <KpiRow metrics={metrics} comparison={comparison} />

          {/* Seccion 4: SLA y RIESGO */}
          <SectionHeader title="SLA y riesgo" subtitle="Cumplimiento del SLA fisico (excluye SaaS y otro)" />
          <SlaKpiRow sla={sla} />
          <RiskRow sla={sla} metrics={metrics} />

          {/* Seccion 5: CHARTS */}
          <SectionHeader title="Tendencias" />
          <ThroughputChart data={metrics.ops_throughput_by_week ?? []} />
          <SlaChart data={sla.sla_by_week} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <OrdersTimeChart data={metrics.orders_by_date} />
            </div>
            <PurchaseTypeChart data={metrics.by_purchase_type} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ProductBreakdown data={metrics.by_product} />
            </div>
            <StatusDistChart data={metrics.by_status} />
          </div>

          {/* Seccion 6: Quien vende mas (podium de solicitantes) */}
          <SectionHeader
            title="Quién vende más"
            subtitle="Equipos físicos vendidos por solicitante en el periodo (excluye SaaS+Hardware)"
          />
          <RequesterPodium ranking={ranking} />
        </>
      ) : (
        <>
          {/* KPI cards (layout legacy) */}
          <KpiRow metrics={metrics} comparison={comparison} />

          {/* SLA KPI cards */}
          <SlaKpiRow sla={sla} />

          {/* SLA Chart */}
          <SlaChart data={sla.sla_by_week} />

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <OrdersTimeChart data={metrics.orders_by_date} />
            </div>
            <PurchaseTypeChart data={metrics.by_purchase_type} />
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ProductBreakdown data={metrics.by_product} />
            </div>
            <StatusDistChart data={metrics.by_status} />
          </div>

          {/* Podium de solicitantes (también en layout V1) */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Quién vende más</h2>
            <p className="text-xs text-gray-500">
              Equipos físicos vendidos por solicitante en el periodo (excluye SaaS+Hardware).
            </p>
            <RequesterPodium ranking={ranking} />
          </section>
        </>
      )}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-gray-100 pb-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}
