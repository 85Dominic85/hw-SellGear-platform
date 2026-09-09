'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Shipment, ShippingEvent } from '@/types/database'
import { tipsaEventLabel } from '@/lib/tipsa/services'

interface ShipmentTrackingPanelProps {
  shipment: Shipment
  events: ShippingEvent[]
  canRefresh: boolean
  canDelete: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ShipmentTrackingPanel({
  shipment,
  events,
  canRefresh,
  canDelete,
}: ShipmentTrackingPanelProps) {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/shipments/${shipment.id}/refresh-tracking`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error refrescando')
      setFeedback(`Tracking actualizado · ${data.events_count} evento(s) (${data.inserted} nuevos)`)
      setTimeout(() => setFeedback(null), 4000)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setRefreshing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el envío ${shipment.shipment_id}? Esta acción no se puede deshacer.`)) {
      return
    }
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/shipments/${shipment.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Error eliminando')
      router.push('/shipments')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Seguimiento TIPSA</h2>
        <div className="flex items-center gap-2">
          {canRefresh && shipment.tracking_number && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'Borrando...' : 'Borrar envío'}
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 ring-1 ring-green-200">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="text-xs font-medium text-gray-500">Albarán</dt>
          <dd className="font-mono text-gray-900">{shipment.albaran ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500">Estado actual</dt>
          <dd className="text-gray-900">
            {shipment.tracking_last_status
              ? tipsaEventLabel(shipment.tracking_last_status)
              : 'Pendiente'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500">Despachado</dt>
          <dd className="text-gray-900">{formatDate(shipment.shipped_at)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500">Entregado</dt>
          <dd className="text-gray-900">{formatDate(shipment.delivered_at)}</dd>
        </div>
        {shipment.tracking_public_url && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-gray-500">Seguimiento público</dt>
            <dd>
              <a
                href={shipment.tracking_public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 underline hover:text-blue-900"
              >
                Ver en TIPSA
              </a>
            </dd>
          </div>
        )}
        {shipment.shipping_label_url && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-gray-500">Etiqueta PDF</dt>
            <dd>
              <a
                href={shipment.shipping_label_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 underline hover:text-blue-900"
              >
                Descargar etiqueta
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className="border-t border-gray-100 pt-3">
        <h3 className="text-xs font-semibold text-gray-700 mb-2">Eventos</h3>
        {events.length === 0 ? (
          <p className="text-xs text-gray-400">Sin eventos registrados.</p>
        ) : (
          <ol className="space-y-2">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex items-start gap-2 text-xs text-gray-600"
              >
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                  {tipsaEventLabel(ev.event_code)}
                </span>
                <span className="text-gray-500">{formatDate(ev.event_date)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
