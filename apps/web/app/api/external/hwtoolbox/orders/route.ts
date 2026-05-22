import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/external-auth'
import { applyCors, handlePreflight } from '@/lib/external-cors'
import type { OrderStatus, PurchaseType } from '@/types/database'
import { isValidPurchaseType } from '@/lib/purchase-type'
import type {
  HwToolboxListResponse,
  HwToolboxOrderListItem,
} from '@/types/external'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Pedidos visibles para HWToolbox: solo en flujo de envio o posteriores.
// El estado "preparado" no existe en el enum (es un flag boolean separado en orders.prepared).
// Borradores ('nuevo','pendiente','falta_informacion','pagado') no aparecen.
export const HWTOOLBOX_VISIBLE_STATUSES: OrderStatus[] = [
  'enviado_proveedor',
  'enviado',
  'completado',
  'bloqueado',
]

// VALID_PURCHASE_TYPES centralizado en lib/purchase-type.ts. Antes este
// Set local omitia 'saas_hardware' (mismo bug que el PATCH del detalle).
// Tras la centralizacion HWToolbox puede filtrar por saas_hardware sin
// devolver 400.

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 50

export function OPTIONS(request: NextRequest) {
  return handlePreflight(request, 'HWTOOLBOX_ORIGIN')
}

export async function GET(request: NextRequest) {
  // 1. Auth con HWTOOLBOX_API_KEY (separada de MAIN_PORTAL_API_KEY)
  const auth = validateApiKey(request, 'HWTOOLBOX_API_KEY')
  if (!auth.ok) return applyCors(auth.response, request, 'HWTOOLBOX_ORIGIN')

  // 2. Parse params
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const purchaseTypeRaw = searchParams.get('purchase_type')
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')
  const limit = clampInt(searchParams.get('limit'), 1, MAX_LIMIT, DEFAULT_LIMIT)
  const offset = clampInt(searchParams.get('offset'), 0, 100_000, 0)

  // Validacion purchase_type (si viene)
  if (purchaseTypeRaw && !isValidPurchaseType(purchaseTypeRaw)) {
    return applyCors(
      NextResponse.json({ error: 'purchase_type inválido' }, { status: 400 }),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  // Validacion fechas (si vienen)
  if (fromRaw && !isValidDate(fromRaw)) {
    return applyCors(
      NextResponse.json({ error: 'from debe ser ISO YYYY-MM-DD' }, { status: 400 }),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }
  if (toRaw && !isValidDate(toRaw)) {
    return applyCors(
      NextResponse.json({ error: 'to debe ser ISO YYYY-MM-DD' }, { status: 400 }),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }
  if (fromRaw && toRaw && fromRaw > toRaw) {
    return applyCors(
      NextResponse.json({ error: 'from no puede ser posterior a to' }, { status: 400 }),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  // 3. Query
  const admin = createAdminClient()
  let query = admin
    .from('orders')
    .select(
      'operation_id, customer_name, venue_name, purchase_type, status, amount, created_at',
      { count: 'exact' },
    )
    .in('status', HWTOOLBOX_VISIBLE_STATUSES)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (purchaseTypeRaw) {
    query = query.eq('purchase_type', purchaseTypeRaw)
  }
  if (fromRaw) {
    query = query.gte('created_at', fromRaw)
  }
  if (toRaw) {
    // to es inclusivo: añadimos un dia para que incluya la fecha completa
    const toExclusive = addOneDay(toRaw)
    query = query.lt('created_at', toExclusive)
  }
  if (q) {
    // Busqueda en operation_id, customer_name o venue_name
    const escaped = q.replace(/[%_]/g, (c) => `\\${c}`)
    const pattern = `%${escaped}%`
    query = query.or(
      `operation_id.ilike.${pattern},customer_name.ilike.${pattern},venue_name.ilike.${pattern}`,
    )
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[external/hwtoolbox/orders] query error:', error.message)
    return applyCors(
      NextResponse.json(
        { error: 'Error consultando pedidos', detail: error.message },
        { status: 502 },
      ),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  const orders = (data ?? []).map((row): HwToolboxOrderListItem => ({
    operation_id: row.operation_id as string,
    customer_name: (row.customer_name as string | null) ?? '',
    venue_name: (row.venue_name as string | null) ?? null,
    purchase_type: (row.purchase_type as PurchaseType | null) ?? null,
    status: row.status as OrderStatus,
    amount: (row.amount as number | null) ?? null,
    created_at: row.created_at as string,
  }))

  const payload: HwToolboxListResponse = {
    generated_at: new Date().toISOString(),
    pagination: {
      total: count ?? orders.length,
      limit,
      offset,
    },
    orders,
  }

  const response = NextResponse.json(payload)
  response.headers.set('Cache-Control', 'private, max-age=30')
  return applyCors(response, request, 'HWTOOLBOX_ORIGIN')
}

// ----------------------- helpers -----------------------

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

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const t = Date.parse(value)
  return !Number.isNaN(t)
}

function addOneDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
