import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

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

  const [metricsRes, comparisonRes] = await Promise.all([
    supabase.rpc('get_dashboard_metrics', rpcParams),
    supabase.rpc('get_dashboard_comparison', rpcParams),
  ])

  if (metricsRes.error) {
    return NextResponse.json({ error: metricsRes.error.message }, { status: 500 })
  }

  return NextResponse.json({
    metrics: metricsRes.data,
    comparison: comparisonRes.data,
  })
}
