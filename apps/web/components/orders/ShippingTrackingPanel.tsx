'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ExternalLink, Info, RefreshCw, Truck, Loader2, Trash2 } from 'lucide-react'
import CreateShipmentModal from './CreateShipmentModal'
import ShippingLabelViewer from './ShippingLabelViewer'
import { isPostDeliveryNote, resolveOfficialStatus } from '@/lib/tipsa/services'
import type { ShippingEvent } from '@/types/database'

interface ShippingTrackingPanelProps {
  orderId: string
  trackingNumber: string | null
  carrier: string | null
  trackingLastStatus: string | null
  trackingLastCheckedAt: string | null
  trackingPublicUrl: string | null
  shippingLabelUrl: string | null
  shippedAt: string | null
  events: ShippingEvent[]
  services: Array<{ code: string; label: string }>
  defaultContent: string
  defaultPackages?: number
  /** Datos del destinatario para el preview de la etiqueta en
   *  CreateShipmentModal antes de crear el envio real. */
  recipientPreview: {
    venueName: string | null
    customerName: string | null
    shippingStreet: string | null
    shippingCp: string | null
    shippingCity: string | null
    shippingAddress: string | null
    phone: string | null
  }
  canCreate: boolean
  canRefresh: boolean
  canDelete: boolean
}

export default function ShippingTrackingPanel({
  orderId,
  trackingNumber,
  carrier,
  trackingLastStatus,
  trackingLastCheckedAt,
  trackingPublicUrl,
  shippingLabelUrl,
  shippedAt,
  events,
  services,
  defaultContent,
  defaultPackages,
  recipientPreview,
  canCreate,
  canRefresh,
  canDelete,
}: ShippingTrackingPanelProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasShipment = Boolean(trackingNumber)

  async function handleRefresh() {
    setError(null)
    setRefreshing(true)
    try {
      const res = await fetch('/api/tipsa/refresh-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error consultando TIPSA')
      } else {
        router.refresh()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleDelete() {
    setError(null)
    setDeleting(true)
    try {
      const res = await fetch(`/api/tipsa/shipment/${orderId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error borrando envío')
        setDeleting(false)
        return
      }
      setConfirmingDelete(false)
      setDeleting(false)
      router.refresh()
    } catch {
      setError('Error de conexión')
      setDeleting(false)
    }
  }

  // Sin envio: solo CTA de creacion (si permisos)
  if (!hasShipment) {
    if (!canCreate) {
      return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Truck className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Envío</h3>
          </div>
          <p className="text-xs text-gray-500">Sin envío creado.</p>
        </div>
      )
    }
    return (
      <>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Envío</h3>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Crear envío TIPSA
          </button>
        </div>
        {modalOpen && (
          <CreateShipmentModal
            orderId={orderId}
            services={services}
            defaultContent={defaultContent}
            defaultPackages={defaultPackages}
            recipient={recipientPreview}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    )
  }

  // Con envio: tracking + timeline
  // Eventos descendentes para render (mas reciente arriba)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
  )
  // Eventos ascendentes para los helpers (mas antiguo primero)
  const eventsAsc = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  )
  // Estado oficial: ignora codigo 3 (Incidencia) post-entrega.
  const officialEvent = resolveOfficialStatus(eventsAsc, (e) => e.event_code)
  const lastLabel =
    officialEvent?.event_label ?? labelForCode(officialEvent?.event_code ?? trackingLastStatus)
  // Set de IDs de eventos que son anotaciones post-entrega (codigo 3 tras codigo 2).
  const postDeliveryNoteIds = new Set<number>(
    eventsAsc
      .filter((_, i) => isPostDeliveryNote(eventsAsc, i, (e) => e.event_code))
      .map((e) => e.id),
  )
  const hasPostDeliveryNotes = postDeliveryNoteIds.size > 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Envío {carrier ? `· ${carrier.toUpperCase()}` : ''}
          </h3>
        </div>
        {canRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="Consultar estado en TIPSA"
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Actualizar
          </button>
        )}
      </div>

      <dl className="mb-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-gray-500">Estado</dt>
          <dd className="font-medium text-gray-900">{lastLabel}</dd>
        </div>
        {hasPostDeliveryNotes && (
          <div className="mt-1 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span>
              TIPSA registró una anotación posterior a la entrega (ver timeline).
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-gray-500">Albarán</dt>
          <dd className="font-mono text-gray-900">{trackingNumber}</dd>
        </div>
        {shippedAt && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Creado</dt>
            <dd className="text-gray-700">{formatDateTime(shippedAt)}</dd>
          </div>
        )}
        {trackingLastCheckedAt && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Consulta</dt>
            <dd className="text-gray-400">hace {relativeTime(trackingLastCheckedAt)}</dd>
          </div>
        )}
      </dl>

      <div className="mb-3 flex flex-wrap gap-2">
        {shippingLabelUrl && <ShippingLabelViewer url={shippingLabelUrl} />}
        {trackingPublicUrl && (
          <a
            href={trackingPublicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Seguimiento <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </div>
      )}

      {sortedEvents.length > 0 && (
        <>
          <h4 className="mb-2 text-xs font-medium text-gray-700">Timeline</h4>
          <ol className="space-y-1.5">
            {sortedEvents.map((ev) => {
              const isNote = postDeliveryNoteIds.has(ev.id)
              const obs = extractObservation(ev.raw_payload)
              return (
                <li key={ev.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      isNote ? 'bg-amber-400' : 'bg-gray-400'
                    }`}
                  />
                  <div className="flex-1">
                    <p
                      className={`flex items-center gap-1 font-medium ${
                        isNote ? 'text-amber-700' : 'text-gray-900'
                      }`}
                    >
                      {isNote && <AlertCircle className="h-3 w-3" />}
                      {isNote ? 'Anotación TIPSA' : ev.event_label ?? ev.event_code}
                    </p>
                    <p className="text-gray-400">{formatDateTime(ev.event_date)}</p>
                    {obs && <p className="mt-0.5 text-gray-500">{obs}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}

      {canDelete && (
        <div className="mt-4 border-t pt-3">
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
            >
              <Trash2 className="h-3 w-3" />
              Borrar envío
            </button>
          ) : (
            <div className="rounded-md border border-red-300 bg-red-50 p-3">
              <p className="mb-2 text-xs font-semibold text-red-800">
                ¿Seguro que quieres borrar este envío?
              </p>
              <p className="mb-3 text-xs text-red-700">
                Se eliminarán de la aplicación: albarán <span className="font-mono">{trackingNumber}</span>,
                la etiqueta PDF y el timeline de eventos. El pedido <strong>no</strong> se borra.
                {trackingNumber?.startsWith('9999')
                  ? ' (Albarán sandbox, no afecta a TIPSA real.)'
                  : ' El envío en TIPSA seguirá existiendo — esta acción solo limpia la referencia local.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                  {deleting ? 'Borrando...' : 'Sí, borrar envío'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function labelForCode(code: string | null): string {
  if (!code) return '—'
  const map: Record<string, string> = {
    '1': 'Alta',
    '2': 'Entregado',
    '3': 'Incidencia',
    '4': 'En tránsito',
    '5': 'En reparto',
    '6': 'Devuelto al origen',
  }
  return map[code] ?? `Estado ${code}`
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/**
 * Intenta extraer una observacion humana del raw_payload del evento.
 * ConsEnvEstados no devuelve observaciones, pero si en el futuro se anaden
 * eventos de ConsEnvIncidencias (campo T_OBS), aqui se renderizarian.
 */
function extractObservation(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null
  const candidates = ['T_OBS', 'V_OBS', 'observation', 'obs', 'comment']
  for (const key of candidates) {
    const v = raw[key]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return null
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} d`
}
