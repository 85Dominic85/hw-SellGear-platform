// =============================================================================
// /tracking — Dashboard tiempo real de estados TIPSA
// -----------------------------------------------------------------------------
// Server component: fetch inicial de orders (carrier=tipsa) + shipments libres
// activos, combina en TrackingEntry[] y pasa al componente cliente que gestiona
// filtros + Realtime.
//
// RLS: la lectura respeta las policies actuales (commercial/viewer leen todo
// desde migracion 20260427000005). No aplicamos filtro `created_by` — el
// toggle "solo mios" se hace en el cliente.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TrackingBoard from '@/components/tracking/TrackingBoard'
import type { TrackingEntry } from '@/lib/tracking/types'
import type { UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

// Ventana amplia para no perder envios activos antiguos. 120 dias cubre
// pedidos que se quedaron en tránsito indefinidamente.
const LOOKBACK_DAYS = 120

interface OrderRow {
  id: string
  operation_id: string
  customer_name: string | null
  venue_name: string | null
  shipping_city: string | null
  tracking_number: string | null
  tracking_public_url: string | null
  tracking_last_status: string | null
  tracking_last_checked_at: string | null
  delivered_at: string | null
  shipped_at: string | null
  created_by: string | null
  creator: { full_name: string | null } | null
}

interface ShipmentRow {
  id: string
  shipment_id: string
  recipient_name: string
  recipient_city: string
  sender_name: string
  sender_city: string
  tracking_number: string | null
  tracking_public_url: string | null
  tracking_last_status: string | null
  tracking_last_checked_at: string | null
  delivered_at: string | null
  shipped_at: string | null
  created_by: string | null
  creator: { full_name: string | null } | null
}

interface EventRow {
  order_id: string | null
  shipment_id: string | null
  event_code: string
  event_date: string
}

export default async function TrackingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = (profile?.role as UserRole | undefined) ?? null

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString()

  // 1) Orders con envio TIPSA en la ventana. Ordenadas por last_checked_at.
  const { data: ordersRaw } = await supabase
    .from('orders')
    .select(
      `id, operation_id, customer_name, venue_name, shipping_city,
       tracking_number, tracking_public_url, tracking_last_status,
       tracking_last_checked_at, delivered_at, shipped_at,
       created_by,
       creator:user_profiles!orders_created_by_fkey(full_name)`,
    )
    .eq('carrier', 'tipsa')
    .not('tracking_number', 'is', null)
    .or(`shipped_at.gte.${cutoff},delivered_at.is.null`)
    .order('tracking_last_checked_at', { ascending: false, nullsFirst: true })
    .limit(500)

  const orders = (ordersRaw ?? []) as unknown as OrderRow[]

  // 2) Shipments libres (SH-*) con tracking en la ventana.
  //
  // RLS: commercial/viewer NO tienen acceso a shipments (solo admin/manager/hardware
  // via canReadFreeShipments). Silenciamos el error en esos roles.
  let shipments: ShipmentRow[] = []
  const canReadShipments = role === 'admin' || role === 'manager' || role === 'hardware'
  if (canReadShipments) {
    const { data: shipmentsRaw } = await supabase
      .from('shipments')
      .select(
        `id, shipment_id, recipient_name, recipient_city, sender_name, sender_city,
         tracking_number, tracking_public_url, tracking_last_status,
         tracking_last_checked_at, delivered_at, shipped_at,
         created_by,
         creator:user_profiles!shipments_created_by_fkey(full_name)`,
      )
      .not('tracking_number', 'is', null)
      .or(`shipped_at.gte.${cutoff},delivered_at.is.null`)
      .order('tracking_last_checked_at', { ascending: false, nullsFirst: true })
      .limit(200)
    shipments = (shipmentsRaw ?? []) as unknown as ShipmentRow[]
  }

  // 3) shipping_events para ambos conjuntos, un solo query.
  const orderIds = orders.map((o) => o.id)
  const shipmentIds = shipments.map((s) => s.id)
  const eventsByOrder = new Map<string, Array<{ event_code: string; event_date: string }>>()
  const eventsByShipment = new Map<string, Array<{ event_code: string; event_date: string }>>()

  if (orderIds.length > 0 || shipmentIds.length > 0) {
    let evQuery = supabase
      .from('shipping_events')
      .select('order_id, shipment_id, event_code, event_date')
      .eq('carrier', 'tipsa')
    if (orderIds.length > 0 && shipmentIds.length > 0) {
      evQuery = evQuery.or(
        `order_id.in.(${orderIds.join(',')}),shipment_id.in.(${shipmentIds.join(',')})`,
      )
    } else if (orderIds.length > 0) {
      evQuery = evQuery.in('order_id', orderIds)
    } else {
      evQuery = evQuery.in('shipment_id', shipmentIds)
    }
    const { data: eventsRaw } = await evQuery.order('event_date', { ascending: true })
    const events = (eventsRaw ?? []) as EventRow[]
    for (const ev of events) {
      const bucket = { event_code: ev.event_code, event_date: ev.event_date }
      if (ev.order_id) {
        const arr = eventsByOrder.get(ev.order_id) ?? []
        arr.push(bucket)
        eventsByOrder.set(ev.order_id, arr)
      } else if (ev.shipment_id) {
        const arr = eventsByShipment.get(ev.shipment_id) ?? []
        arr.push(bucket)
        eventsByShipment.set(ev.shipment_id, arr)
      }
    }
  }

  // 4) Construir el shape unificado TrackingEntry.
  const entries: TrackingEntry[] = [
    ...orders.map((o): TrackingEntry => {
      const displayName = o.customer_name ?? o.venue_name ?? '(sin nombre)'
      const subtitleParts: string[] = []
      if (o.venue_name && o.venue_name !== o.customer_name) subtitleParts.push(o.venue_name)
      if (o.shipping_city) subtitleParts.push(o.shipping_city)
      if (o.creator?.full_name) subtitleParts.push(`AE ${o.creator.full_name}`)
      return {
        kind: 'order',
        id: o.id,
        publicId: o.operation_id,
        href: `/orders/${o.id}`,
        displayName,
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : null,
        albaran: o.tracking_number,
        trackingPublicUrl: o.tracking_public_url,
        trackingLastStatus: o.tracking_last_status,
        trackingLastCheckedAt: o.tracking_last_checked_at,
        deliveredAt: o.delivered_at,
        shippedAt: o.shipped_at,
        createdBy: o.created_by,
        createdByName: o.creator?.full_name ?? null,
        events: eventsByOrder.get(o.id) ?? [],
      }
    }),
    ...shipments.map((s): TrackingEntry => {
      const subtitleParts: string[] = []
      if (s.recipient_city) subtitleParts.push(s.recipient_city)
      if (s.sender_name) subtitleParts.push(`De ${s.sender_name}`)
      if (s.creator?.full_name) subtitleParts.push(`Creado por ${s.creator.full_name}`)
      return {
        kind: 'shipment',
        id: s.id,
        publicId: s.shipment_id,
        href: `/shipments/${s.id}`,
        displayName: s.recipient_name,
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : null,
        albaran: s.tracking_number,
        trackingPublicUrl: s.tracking_public_url,
        trackingLastStatus: s.tracking_last_status,
        trackingLastCheckedAt: s.tracking_last_checked_at,
        deliveredAt: s.delivered_at,
        shippedAt: s.shipped_at,
        createdBy: s.created_by,
        createdByName: s.creator?.full_name ?? null,
        events: eventsByShipment.get(s.id) ?? [],
      }
    }),
  ]

  return (
    <div>
      <header className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Tracking de envíos TIPSA
        </h1>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Estado en tiempo real de todos los envíos activos · actualizado cada 30 min
        </p>
      </header>
      <TrackingBoard entries={entries} currentUserId={user.id} />
    </div>
  )
}
