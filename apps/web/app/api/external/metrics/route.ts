import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/external-auth'
import { applyCors, handlePreflight } from '@/lib/external-cors'
import type {
  ExternalMetricsResponse,
  ExternalSla,
} from '@/types/external'
import type { DashboardMetrics, DashboardComparison, SlaMetrics } from '@/types/metrics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_PURCHASE_TYPES = new Set([
  'kit_digital',
  'hardware_one_off',
  'hardware_financiacion',
  'transferencias_saas',
  'otro',
])

const DEFAULT_RECENT_LIMIT = 10
const MAX_RECENT_LIMIT = 50
const DEFAULT_SLA: ExternalSla = {
  total_delivered: 0,
  avg_delivery_days: 0,
  on_time_pct: 0,
  breached_count: 0,
  active_at_risk: 0,
  sla_by_week: [],
}

export function OPTIONS(request: NextRequest) {
  return handlePreflight(request)
}

export async function GET(request: NextRequest) {
  // 1. Auth
  const auth = validateApiKey(request)
  if (!auth.ok) return applyCors(auth.response, request)

  // 2. Parse params
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? defaultFrom()
  const to = searchParams.get('to') ?? defaultTo()
  const purchaseTypeRaw = searchParams.get('purchase_type') ?? 'all'
  const recentLimit = clampInt(
    searchParams.get('recent_limit'),
    1,
    MAX_RECENT_LIMIT,
    DEFAULT_RECENT_LIMIT,
  )

  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    return applyCors(
      NextResponse.json({ error: 'Rango from/to inválido' }, { status: 400 }),
      request,
    )
  }
  if (
    purchaseTypeRaw !== 'all' &&
    !VALID_PURCHASE_TYPES.has(purchaseTypeRaw)
  ) {
    return applyCors(
      NextResponse.json({ error: 'purchase_type inválido' }, { status: 400 }),
      request,
    )
  }
  const purchaseType = purchaseTypeRaw === 'all' ? null : purchaseTypeRaw

  // 3. Fan-out a las 3 RPCs + lista de pedidos recientes
  const admin = createAdminClient()
  const rpcParams: Record<string, string> = { p_from: from, p_to: to }
  if (purchaseType) rpcParams.p_purchase_type = purchaseType

  let recentQuery = admin
    .from('orders')
    .select(
      'operation_id, created_at, customer_name, venue_name, purchase_type, amount, status, tracking_number',
    )
    .order('created_at', { ascending: false })
    .limit(recentLimit)
  if (purchaseType) {
    recentQuery = recentQuery.eq('purchase_type', purchaseType)
  }

  const [metricsRes, comparisonRes, slaRes, recentRes] = await Promise.all([
    admin.rpc('get_dashboard_metrics', rpcParams),
    admin.rpc('get_dashboard_comparison', rpcParams),
    admin.rpc('get_sla_metrics', { p_from: from, p_to: to }),
    recentQuery,
  ])

  if (metricsRes.error) {
    console.error('[external/metrics] get_dashboard_metrics error:', metricsRes.error.message)
    return applyCors(
      NextResponse.json(
        { error: 'Error consultando métricas', detail: metricsRes.error.message },
        { status: 502 },
      ),
      request,
    )
  }

  const metrics = (metricsRes.data ?? null) as DashboardMetrics | null
  const comparison = (comparisonRes.data ?? null) as DashboardComparison | null
  const sla = (slaRes.data ?? null) as SlaMetrics | null

  const payload: ExternalMetricsResponse = {
    generated_at: new Date().toISOString(),
    range: { from, to },
    kpis: {
      total_orders: metrics?.total_orders ?? 0,
      total_revenue: metrics?.total_revenue ?? 0,
      avg_order_value: metrics?.avg_order_value ?? 0,
      completed_rate: metrics?.completed_rate ?? 0,
    },
    comparison: comparison
      ? {
          prev_total_orders: comparison.prev_total_orders,
          prev_total_revenue: comparison.prev_total_revenue,
          prev_avg_order_value: comparison.prev_avg_order_value,
          prev_completed_rate: comparison.prev_completed_rate,
        }
      : null,
    time_series: {
      orders_by_date: metrics?.orders_by_date ?? [],
    },
    breakdowns: {
      by_purchase_type: metrics?.by_purchase_type ?? [],
      by_status: metrics?.by_status ?? [],
      by_product: metrics?.by_product ?? [],
    },
    sla: sla ?? DEFAULT_SLA,
    recent_orders: (recentRes.data ?? []) as ExternalMetricsResponse['recent_orders'],
  }

  const response = NextResponse.json(payload)
  response.headers.set('Cache-Control', 'private, max-age=60')
  return applyCors(response, request)
}

// ----------------------- helpers -----------------------

function defaultFrom(): string {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return start.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return false
  const t = Date.parse(value)
  return !Number.isNaN(t)
}

function clampInt(
  raw: string | null,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
