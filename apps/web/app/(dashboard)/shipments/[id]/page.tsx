import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Shipment, ShippingEvent, UserRole } from '@/types/database'
import {
  canDeleteFreeShipment,
  canReadFreeShipments,
  canRefreshTracking,
} from '@/lib/auth'
import ShipmentTrackingPanel from '@/components/shipments/ShipmentTrackingPanel'

interface PageProps {
  params: Promise<{ id: string }>
}

const SELECT =
  'id, shipment_id, created_at, updated_at, created_by, sender_name, sender_address, sender_cp, sender_city, sender_phone, recipient_name, recipient_address, recipient_cp, recipient_city, recipient_phone, recipient_email, recipient_contact_person, service_code, packages, weight_kg, content, observations, return_shipment, saturday_delivery, reference, albaran, tracking_number, tracking_public_url, carrier_guid, tracking_last_status, tracking_last_checked_at, shipped_at, delivered_at, shipping_label_url, notes'

export default async function ShipmentDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profile?.role as UserRole | undefined
  if (!canReadFreeShipments(role)) redirect('/orders')

  const { data: shipment, error } = await supabase
    .from('shipments')
    .select(SELECT)
    .eq('id', id)
    .single<Shipment>()

  if (error || !shipment) notFound()

  const { data: eventsData } = await supabase
    .from('shipping_events')
    .select('*')
    .eq('shipment_id', shipment.id)
    .order('event_date', { ascending: true })

  const events = (eventsData ?? []) as ShippingEvent[]

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/shipments"
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Volver a envíos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{shipment.shipment_id}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Creado el{' '}
          {new Date(shipment.created_at).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Bloques sender / recipient / details */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReadOnlyCard
          title="Remitente"
          rows={[
            ['Nombre', shipment.sender_name],
            ['Dirección', shipment.sender_address],
            ['CP / Ciudad', `${shipment.sender_cp} ${shipment.sender_city}`],
            ['Teléfono', shipment.sender_phone ?? '—'],
          ]}
        />
        <ReadOnlyCard
          title="Destinatario"
          rows={[
            ['Nombre', shipment.recipient_name],
            ['Dirección', shipment.recipient_address],
            ['CP / Ciudad', `${shipment.recipient_cp} ${shipment.recipient_city}`],
            ['Teléfono', shipment.recipient_phone ?? '—'],
            ['Email', shipment.recipient_email ?? '—'],
            ['Contacto', shipment.recipient_contact_person ?? '—'],
          ]}
        />
        <ReadOnlyCard
          title="Detalles"
          rows={[
            ['Servicio', shipment.service_code],
            ['Bultos', String(shipment.packages)],
            ['Peso', `${shipment.weight_kg} kg`],
            ['Contenido', shipment.content ?? '—'],
            ['Retorno', shipment.return_shipment ? 'Sí' : 'No'],
            ['Sábado', shipment.saturday_delivery ? 'Sí' : 'No'],
            ['Referencia', shipment.reference ?? '—'],
          ]}
        />
        <ReadOnlyCard
          title="Notas y observaciones"
          rows={[
            ['Observaciones', shipment.observations ?? '—'],
            ['Notas internas', shipment.notes ?? '—'],
          ]}
        />
      </div>

      <ShipmentTrackingPanel
        shipment={shipment}
        events={events}
        canRefresh={canRefreshTracking(role)}
        canDelete={canDeleteFreeShipment(role)}
      />
    </div>
  )
}

function ReadOnlyCard({
  title,
  rows,
}: {
  title: string
  rows: [string, string][]
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-3 gap-2">
            <dt className="col-span-1 text-xs text-gray-500">{label}</dt>
            <dd className="col-span-2 text-gray-900 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
