import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/external-auth'
import { applyCors, handlePreflight } from '@/lib/external-cors'
import { tipsaEventLabel } from '@/lib/tipsa/services'
import type { ShipmentStatus } from '@/types/database'
import type {
  HwToolboxShipmentCreator,
  HwToolboxShipmentDetail,
  HwToolboxShipmentDetailResponse,
} from '@/types/external'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: NextRequest) {
  return handlePreflight(request, 'HWTOOLBOX_ORIGIN')
}

interface ShipmentRow {
  shipment_id: string
  status: ShipmentStatus
  sender_name: string
  sender_address: string
  sender_cp: string
  sender_city: string
  sender_phone: string | null
  recipient_name: string
  recipient_address: string
  recipient_cp: string
  recipient_city: string
  recipient_phone: string | null
  recipient_email: string | null
  recipient_contact_person: string | null
  service_code: string
  packages: number | null
  weight_kg: number | string | null
  content: string | null
  observations: string | null
  notes: string | null
  reference: string | null
  return_shipment: boolean | null
  albaran: string | null
  tracking_number: string | null
  tracking_public_url: string | null
  tracking_last_status: string | null
  tracking_last_checked_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  shipping_label_url: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

interface UserRow {
  full_name: string | null
  email: string | null
}

const DETAIL_COLUMNS = [
  'shipment_id',
  'status',
  'sender_name',
  'sender_address',
  'sender_cp',
  'sender_city',
  'sender_phone',
  'recipient_name',
  'recipient_address',
  'recipient_cp',
  'recipient_city',
  'recipient_phone',
  'recipient_email',
  'recipient_contact_person',
  'service_code',
  'packages',
  'weight_kg',
  'content',
  'observations',
  'notes',
  'reference',
  'return_shipment',
  'albaran',
  'tracking_number',
  'tracking_public_url',
  'tracking_last_status',
  'tracking_last_checked_at',
  'shipped_at',
  'delivered_at',
  'shipping_label_url',
  'created_at',
  'updated_at',
  'created_by',
].join(', ')

/**
 * Detalle de un envío TIPSA libre por su `shipment_id` (SH-YYYYMM-NNNN).
 *
 * A diferencia del detalle de pedido, aquí no hay líneas ni totales: un envío
 * libre no lleva precios. Lo que salió está en `content`, texto libre, y no se
 * intenta derivar SKU de ahí — se entrega tal cual.
 *
 * Tampoco se inventa un estado: van los hechos crudos (`shipped_at`,
 * `delivered_at` y el `tracking_last_status` que devuelve TIPSA) y HWToolbox
 * concluye. `shipments` no tiene el enum de `orders`, así que no hay filtro de
 * visibilidad: un 404 significa que no existe, sin más.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> },
) {
  // 1. Auth
  const auth = validateApiKey(request, 'HWTOOLBOX_API_KEY')
  if (!auth.ok) return applyCors(auth.response, request, 'HWTOOLBOX_ORIGIN')

  // 2. Path param
  const { shipmentId } = await params
  const shId = shipmentId.trim()
  if (!shId) {
    return applyCors(
      NextResponse.json({ error: 'shipmentId vacío' }, { status: 400 }),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  const admin = createAdminClient()

  const shipmentRes = await admin
    .from('shipments')
    .select(DETAIL_COLUMNS)
    .eq('shipment_id', shId)
    .maybeSingle()

  if (shipmentRes.error) {
    console.error(
      '[external/hwtoolbox/shipments/detail] query error:',
      shipmentRes.error.message,
    )
    return applyCors(
      NextResponse.json(
        { error: 'Error consultando envío', detail: shipmentRes.error.message },
        { status: 502 },
      ),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  if (!shipmentRes.data) {
    return applyCors(
      NextResponse.json({ error: 'not_found' }, { status: 404 }),
      request,
      'HWTOOLBOX_ORIGIN',
    )
  }

  const sh = shipmentRes.data as unknown as ShipmentRow

  // 3. Quién lo creó, si la fila lo tiene. Mismo patrón que el `ae` del
  //    detalle de pedido, pero sin `ae_ref`: un envío no tiene AE.
  let createdBy: HwToolboxShipmentCreator | null = null
  if (sh.created_by) {
    const userRes = await admin
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', sh.created_by)
      .maybeSingle()
    if (!userRes.error && userRes.data) {
      const u = userRes.data as UserRow
      createdBy = { full_name: u.full_name, email: u.email }
    }
  }

  const detail: HwToolboxShipmentDetail = {
    shipment_id: sh.shipment_id,
    status: sh.status,
    sender: {
      name: sh.sender_name,
      address: sh.sender_address,
      cp: sh.sender_cp,
      city: sh.sender_city,
      phone: sh.sender_phone ?? null,
    },
    recipient: {
      name: sh.recipient_name,
      address: sh.recipient_address,
      cp: sh.recipient_cp,
      city: sh.recipient_city,
      phone: sh.recipient_phone ?? null,
      email: sh.recipient_email ?? null,
      contact_person: sh.recipient_contact_person ?? null,
    },
    service_code: sh.service_code,
    packages: Number(sh.packages ?? 1),
    // weight_kg es NUMERIC(10,3): PostgREST lo puede serializar como string,
    // así que se normaliza a number para no romper el contrato.
    weight_kg: Number(sh.weight_kg ?? 0),
    content: sh.content ?? null,
    observations: sh.observations ?? null,
    notes: sh.notes ?? null,
    reference: sh.reference ?? null,
    return_shipment: Boolean(sh.return_shipment),
    albaran: sh.albaran ?? null,
    tracking_number: sh.tracking_number ?? null,
    tracking_public_url: sh.tracking_public_url ?? null,
    tracking_last_status: sh.tracking_last_status ?? null,
    // Se traduce aquí con la misma tabla que usa la app: un '1' suelto no
    // dice nada y duplicar el mapeo en el consumidor lo condena a
    // desincronizarse.
    tracking_last_status_label: sh.tracking_last_status
      ? tipsaEventLabel(sh.tracking_last_status)
      : null,
    tracking_last_checked_at: sh.tracking_last_checked_at ?? null,
    shipped_at: sh.shipped_at ?? null,
    delivered_at: sh.delivered_at ?? null,
    shipping_label_url: sh.shipping_label_url ?? null,
    created_at: sh.created_at,
    updated_at: sh.updated_at,
    created_by: createdBy,
  }

  const payload: HwToolboxShipmentDetailResponse = {
    generated_at: new Date().toISOString(),
    shipment: detail,
  }

  const response = NextResponse.json(payload)
  response.headers.set('Cache-Control', 'private, max-age=30')
  return applyCors(response, request, 'HWTOOLBOX_ORIGIN')
}
