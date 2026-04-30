import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCSV, type CsvSummary } from '@/lib/metrics'
import type { UserRole } from '@/types/database'
import type { DashboardMetrics, SlaMetrics } from '@/types/metrics'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES: UserRole[] = ['admin', 'manager', 'hardware']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.includes(profile.role as UserRole)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'Faltan parámetros from/to' }, { status: 400 })
  }

  const purchaseType = searchParams.get('purchase_type')
  const purchaseTypeFilter = purchaseType && purchaseType !== 'all' ? purchaseType : null

  let ordersQuery = supabase
    .from('orders')
    .select(
      'operation_id, created_at, customer_name, venue_name, purchase_type, amount, status, supplier, shipped_at, delivered_at, order_items(product_name, qty)',
    )
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })

  if (purchaseTypeFilter) {
    ordersQuery = ordersQuery.eq('purchase_type', purchaseTypeFilter)
  }

  const metricsRpcParams: Record<string, string> = { p_from: from, p_to: to }
  if (purchaseTypeFilter) metricsRpcParams.p_purchase_type = purchaseTypeFilter

  const [ordersRes, metricsRes, slaRes] = await Promise.all([
    ordersQuery,
    supabase.rpc('get_dashboard_metrics', metricsRpcParams),
    supabase.rpc('get_sla_metrics', { p_from: from, p_to: to }),
  ])

  if (ordersRes.error) {
    return NextResponse.json({ error: ordersRes.error.message }, { status: 500 })
  }

  const dashboardMetrics = (metricsRes.data ?? null) as DashboardMetrics | null
  const slaMetrics = (slaRes.data ?? null) as SlaMetrics | null

  const summary: CsvSummary | undefined = dashboardMetrics
    ? {
        from,
        to,
        purchase_type: purchaseType ?? 'all',
        total_orders: dashboardMetrics.total_orders,
        total_revenue: dashboardMetrics.total_revenue,
        avg_order_value: dashboardMetrics.avg_order_value,
        completed_rate: dashboardMetrics.completed_rate,
        ops_total_shipped: dashboardMetrics.ops_total_shipped,
        ops_total_completed: dashboardMetrics.ops_total_completed,
        ops_avg_handling_days: dashboardMetrics.ops_avg_handling_days,
        ops_avg_transit_days: dashboardMetrics.ops_avg_transit_days,
        ops_on_time_shipping_pct: dashboardMetrics.ops_on_time_shipping_pct,
        ops_blocked_count: dashboardMetrics.ops_blocked_count,
        ops_excluded_admin: dashboardMetrics.ops_excluded_admin,
        sla_total_delivered: slaMetrics?.total_delivered,
        sla_avg_delivery_days: slaMetrics?.avg_delivery_days,
        sla_on_time_pct: slaMetrics?.on_time_pct,
        sla_breached_count: slaMetrics?.breached_count,
        sla_active_at_risk: slaMetrics?.active_at_risk,
      }
    : undefined

  const rows = (ordersRes.data || []).map((o) => ({
    operation_id: o.operation_id,
    created_at: o.created_at,
    customer_name: o.customer_name,
    venue_name: o.venue_name,
    purchase_type: o.purchase_type,
    amount: o.amount,
    status: o.status,
    supplier: o.supplier,
    shipped_at: o.shipped_at,
    delivered_at: o.delivered_at,
    products: (o.order_items || [])
      .map((i: { product_name: string; qty: number }) => `${i.product_name} x${i.qty}`)
      .join('; '),
  }))

  const csv = generateCSV(rows, { summary })
  const filename = `metricas_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
