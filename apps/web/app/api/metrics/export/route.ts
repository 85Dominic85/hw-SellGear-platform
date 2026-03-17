import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCSV } from '@/lib/metrics'
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

  let query = supabase
    .from('orders')
    .select('operation_id, created_at, customer_name, venue_name, purchase_type, amount, status, supplier, order_items(product_name, qty)')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })

  if (purchaseType && purchaseType !== 'all') {
    query = query.eq('purchase_type', purchaseType)
  }

  const { data: orders, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (orders || []).map((o) => ({
    operation_id: o.operation_id,
    created_at: o.created_at,
    customer_name: o.customer_name,
    venue_name: o.venue_name,
    purchase_type: o.purchase_type,
    amount: o.amount,
    status: o.status,
    supplier: o.supplier,
    products: (o.order_items || [])
      .map((i: { product_name: string; qty: number }) => `${i.product_name} x${i.qty}`)
      .join('; '),
  }))

  const csv = generateCSV(rows)
  const filename = `metricas_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
