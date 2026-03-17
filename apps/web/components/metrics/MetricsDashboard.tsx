'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDateRange } from '@/lib/metrics'
import type { DashboardMetrics, DashboardComparison, PeriodPreset } from '@/types/metrics'
import type { PurchaseType } from '@/types/database'
import KpiRow from './KpiRow'
import PeriodSelector from './PeriodSelector'
import PurchaseTypeFilter from './PurchaseTypeFilter'
import ExportButton from './ExportButton'
import OrdersTimeChart from './OrdersTimeChart'
import PurchaseTypeChart from './PurchaseTypeChart'
import ProductBreakdown from './ProductBreakdown'
import StatusDistChart from './StatusDistChart'

interface MetricsDashboardProps {
  initialMetrics: DashboardMetrics
  initialComparison: DashboardComparison
}

export default function MetricsDashboard({ initialMetrics, initialComparison }: MetricsDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics)
  const [comparison, setComparison] = useState<DashboardComparison>(initialComparison)
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
      setComparison(data.comparison)
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

      {/* KPI cards */}
      <KpiRow metrics={metrics} comparison={comparison} />

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
    </div>
  )
}
