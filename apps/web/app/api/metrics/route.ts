import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

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
  const rpcParams: Record<string, string> = { p_from: from, p_to: to }
  if (purchaseType && purchaseType !== 'all') {
    rpcParams.p_purchase_type = purchaseType
  }

  const [metricsRes, comparisonRes, slaRes, rankingRes] = await Promise.all([
    supabase.rpc('get_dashboard_metrics', rpcParams),
    supabase.rpc('get_dashboard_comparison', rpcParams),
    supabase.rpc('get_sla_metrics', { p_from: from, p_to: to }),
    supabase.rpc('get_requesters_ranking', rpcParams),
  ])

  // Si la principal falla devolvemos 500. Comparison, SLA y ranking degradan
  // a null/default/[] y se reportan como warnings para no romper el panel
  // cuando solo una RPC falla.
  if (metricsRes.error) {
    return NextResponse.json({ error: metricsRes.error.message }, { status: 500 })
  }

  const warnings: { source: string; message: string }[] = []
  if (comparisonRes.error) warnings.push({ source: 'comparison', message: comparisonRes.error.message })
  if (slaRes.error) warnings.push({ source: 'sla', message: slaRes.error.message })
  if (rankingRes.error) warnings.push({ source: 'ranking', message: rankingRes.error.message })

  return NextResponse.json({
    metrics: metricsRes.data,
    comparison: comparisonRes.data ?? null,
    sla: slaRes.data ?? {
      total_delivered: 0,
      avg_delivery_days: 0,
      on_time_pct: 0,
      breached_count: 0,
      active_at_risk: 0,
      sla_by_week: [],
    },
    ranking: rankingRes.data ?? [],
    warnings: warnings.length ? warnings : undefined,
  })
}
