'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'

interface ServiceOption {
  code: string
  label: string
}

interface CreateShipmentModalProps {
  orderId: string
  services: ServiceOption[]
  defaultContent?: string
  onClose: () => void
}

export default function CreateShipmentModal({
  orderId,
  services,
  defaultContent,
  onClose,
}: CreateShipmentModalProps) {
  const router = useRouter()
  const [serviceCode, setServiceCode] = useState(services[0]?.code ?? '48')
  const [packages, setPackages] = useState(1)
  const [weightKg, setWeightKg] = useState(1)
  const [content, setContent] = useState(defaultContent ?? 'Productos hardware')
  const [observations, setObservations] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [loading, onClose])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setLoading(true)
      try {
        const res = await fetch('/api/tipsa/create-shipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            service_code: serviceCode,
            packages,
            weight_kg: weightKg,
            content,
            observations: observations.trim() || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Error creando envío')
          return
        }
        router.refresh()
        onClose()
      } catch {
        setError('Error de conexión. Inténtalo de nuevo.')
      } finally {
        setLoading(false)
      }
    },
    [orderId, serviceCode, packages, weightKg, content, observations, router, onClose],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl"
        style={{ colorScheme: 'light' }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Crear envío TIPSA</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Servicio
            </label>
            <select
              value={serviceCode}
              onChange={(e) => setServiceCode(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={loading}
            >
              {services.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Bultos</label>
              <input
                type="number"
                min={1}
                step={1}
                value={packages}
                onChange={(e) => setPackages(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Peso (kg)</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={weightKg}
                onChange={(e) => setWeightKg(Math.max(0.1, Number(e.target.value)))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Contenido</label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={100}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Observaciones (opcional)
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              maxLength={200}
              className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={loading}
              placeholder="Ej: Dejar en portería"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear envío
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
