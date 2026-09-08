import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/external-auth'
import { applyCors, handlePreflight } from '@/lib/external-cors'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OFFSET,
  addOneDay,
  clampInt,
  ilikePattern,
  isValidDate,
} from '@/lib/external-query'
import type { ShipmentStatus } from '@/types/database'
import type {
  HwToolboxShipmentListItem,
  HwToolboxShipmentsListResponse,
} from '@/types/external'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Listado de envíos TIPSA libres (tabla `shipments`, id SH-YYYYMM-NNNN).
 *
 * Son etiquetas que no cuelgan de un pedido: material de cliente a cliente, o
 * que vuelve a nosotros (RMA, reparación). HWToolbox no los veía porque solo
 * consumía `/orders`, y sin embargo son movimientos de almacén igual de
 * reales — lo que va dentro está en `content`, texto libre.
 *
 * SIN filtro de visibilidad, a diferencia de los pedidos: `shipments` no tiene
 * estado del enum de `orders`, y la fila se crea junto con la etiqueta TIPSA,
 * así que no hay borradores que esconder. Ordenado por `created_at` DESC,
 * igual que el listado de pedidos.
 */
export function OPTIONS(request: NextRequest) {
  return handlePreflight(request, 'HWTOOLBOX_ORIGIN')
}

/** Columnas del listado. Explícitas: el detalle es otro endpoint. */
const LIST_COLUMNS =
  'shipment_id, status, sender_name, recipient_name, recipient_city, content, packages, return_shipment, albaran, tracking_number, shipped_at, delivered_at, created_at'

export async function GET(request: NextRequest) {
  // 1. Auth con la misma HWTOOLBOX_API_KEY que el resto del contrato.
  const auth = validateApiKey(request, 'HWTOOLBOX_API_KEY')
  if (!auth.ok) return applyCors(auth.response, request, 'HWTOOLBOX_ORIGIN')

  // 2. Parse params (mismos nombres y límites que /orders, vía lib/external-query)
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')
  const limit = clampInt(searchParams.get('limit'), 1, MAX_LIMIT, DEFAULT_LIMIT)
  const offset = clampInt(searchParams.get('offset'), 0, MAX_OFFSET, 0)

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
    .from('shipments')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (fromRaw) {
    query = query.gte('created_at', fromRaw)
  }
  if (toRaw) {
    // `to` es inclusivo: se traduce a "< to + 1 día".
    query = query.lt('created_at', addOneDay(toRaw))
  }
  if (q) {
    /*
     * Se busca por más campos que en pedidos a propósito: quien usa un
     * inventario tiene delante la etiqueta física, así que el dato a mano es
     * el albarán o el número de seguimiento, no el nombre del destinatario.
     */
    const pattern = ilikePattern(q)
    query = query.or(
      [
        `shipment_id.ilike.${pattern}`,
        `recipient_name.ilike.${pattern}`,
        `sender_name.ilike.${pattern}`,
        `reference.ilike.${pattern}`,
        `albaran.ilike.${pattern}`,
        `tracking_number.ilike.${pattern}`,
      ].join(','),
    )
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[external/hwtoolbox/shipments] query error:', error.message)
    return applyCors(
      NextResponse.json(
        { error: 'Error consultando envíos', detail: error.message },
        { status: 502 },
      ),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  const rows = (data ?? []) as unknown as ShipmentListRow[]
  const shipments = rows.map(
    (row): HwToolboxShipmentListItem => ({
      shipment_id: row.shipment_id,
      status: row.status,
      sender_name: row.sender_name ?? '',
      recipient_name: row.recipient_name ?? '',
      recipient_city: row.recipient_city ?? '',
      content: row.content ?? null,
      packages: Number(row.packages ?? 1),
      return_shipment: Boolean(row.return_shipment),
      albaran: row.albaran ?? null,
      tracking_number: row.tracking_number ?? null,
      shipped_at: row.shipped_at ?? null,
      delivered_at: row.delivered_at ?? null,
      created_at: row.created_at,
    }),
  )

  const payload: HwToolboxShipmentsListResponse = {
    generated_at: new Date().toISOString(),
    pagination: {
      total: count ?? shipments.length,
      limit,
      offset,
    },
    shipments,
  }

  const response = NextResponse.json(payload)
  response.headers.set('Cache-Control', 'private, max-age=30')
  return applyCors(response, request, 'HWTOOLBOX_ORIGIN')
}

interface ShipmentListRow {
  shipment_id: string
  status: ShipmentStatus
  sender_name: string | null
  recipient_name: string | null
  recipient_city: string | null
  content: string | null
  packages: number | null
  return_shipment: boolean | null
  albaran: string | null
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
}
