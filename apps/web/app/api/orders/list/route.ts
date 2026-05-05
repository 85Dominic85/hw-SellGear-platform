import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Order, OrderStatus, PurchaseType } from '@/types/database'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 50

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

/**
 * GET /api/orders/list
 *
 * Endpoint dedicado al boton "Cargar 50 mas" del listado /orders.
 * Devuelve JSON paginado por (offset, limit), no por page=N.
 * Aplica los mismos filtros que /orders (status, type, shipping, search).
 * RLS filtra automaticamente segun el rol.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const sp = new URL(request.url).searchParams
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0)
  const limit = clampInt(sp.get('limit'), 1, MAX_LIMIT, DEFAULT_LIMIT)

  let q = supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })

  const status = sp.get('status')
  if (status) q = q.eq('status', status as OrderStatus)

  const type = sp.get('type')
  if (type) q = q.eq('purchase_type', type as PurchaseType)

  const shipping = sp.get('shipping')
  if (shipping) q = q.eq('status', shipping as OrderStatus)

  const search = sp.get('search')
  if (search) {
    const term = `%${search}%`
    q = q.or(
      `customer_name.ilike.${term},operation_id.ilike.${term},venue_name.ilike.${term}`,
    )
  }

  const { data, error } = await q.range(offset, offset + limit - 1)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ orders: (data ?? []) as Order[] })
}
