import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDateRange } from '@/lib/metrics'
import type { UserRole } from '@/types/database'
import type { DashboardMetrics, DashboardComparison, SlaMetrics } from '@/types/metrics'
import MetricsDashboard from '@/components/metrics/MetricsDashboard'

const ALLOWED_ROLES: UserRole[] = ['admin', 'manager', 'hardware']

export default async function MetricsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role as UserRole | undefined
  if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
    redirect('/orders')
  }

  // Fetch initial data: this month
  const { from, to } = getDateRange('this_month')

  const [metricsRes, comparisonRes, slaRes] = await Promise.all([
    supabase.rpc('get_dashboard_metrics', { p_from: from, p_to: to }),
    supabase.rpc('get_dashboard_comparison', { p_from: from, p_to: to }),
    supabase.rpc('get_sla_metrics', { p_from: from, p_to: to }),
  ])

  const metrics: DashboardMetrics = metricsRes.data ?? {
    total_orders: 0,
    total_revenue: 0,
    avg_order_value: 0,
    completed_rate: 0,
    orders_by_date: [],
    by_purchase_type: [],
    by_status: [],
    by_product: [],
  }

  // comparison puede ser null si la RPC falla; el cliente hace null-checks.
  const comparison: DashboardComparison | null = comparisonRes.data ?? null

  const sla: SlaMetrics = slaRes.data ?? {
    total_delivered: 0,
    avg_delivery_days: 0,
    on_time_pct: 0,
    breached_count: 0,
    active_at_risk: 0,
    sla_by_week: [],
  }

  return (
    <div className="px-6 py-8">
      <MetricsDashboard initialMetrics={metrics} initialComparison={comparison} initialSla={sla} />
    </div>
  )
}
