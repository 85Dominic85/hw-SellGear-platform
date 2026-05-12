'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_TRANSITIONS } from '@/lib/utils'
import type { ShipmentStatus } from '@/types/database'
import ShipmentStatusBadge from './ShipmentStatusBadge'

interface ShipmentStatusChangePanelProps {
  shipmentId: string
  currentStatus: ShipmentStatus
}

export default function ShipmentStatusChangePanel({
  shipmentId,
  currentStatus,
}: ShipmentStatusChangePanelProps) {
  const router = useRouter()
  const [selectedStatus, setSelectedStatus] = useState<ShipmentStatus | ''>('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const availableTransitions = SHIPMENT_STATUS_TRANSITIONS[currentStatus] ?? []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStatus) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/shipments/${shipmentId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus, comment: comment.trim() || null }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Error al cambiar el estado' })
      } else {
        setMessage({
          type: 'success',
          text: `Estado cambiado a "${SHIPMENT_STATUS_LABELS[data.status as ShipmentStatus]}"`,
        })
        setSelectedStatus('')
        setComment('')
        router.refresh()
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión. Inténtalo de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">Cambiar estado</h3>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-gray-500">Estado actual:</span>
        <ShipmentStatusBadge status={currentStatus} />
      </div>

      {availableTransitions.length === 0 ? (
        <p className="text-sm text-gray-400 italic">
          No hay transiciones disponibles desde este estado.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Nuevo estado
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ShipmentStatus | '')}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              required
            >
              <option value="">Seleccionar estado...</option>
              {availableTransitions.map((status) => (
                <option key={status} value={status}>
                  {SHIPMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Comentario (opcional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Añade una nota sobre este cambio..."
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>

          {message && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                  : 'bg-red-50 text-red-700 ring-1 ring-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedStatus}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Cambiando...' : 'Cambiar estado'}
          </button>
        </form>
      )}
    </div>
  )
}
