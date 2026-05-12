'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Shipment } from '@/types/database'
import { tipsaEventLabel } from '@/lib/tipsa/services'
import ShipmentStatusBadge from './ShipmentStatusBadge'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500'

interface ShipmentsTableProps {
  canCreate: boolean
}

interface ApiResponse {
  shipments: Shipment[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = 20

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ShipmentsTable({ canCreate }: ShipmentsTableProps) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (debouncedQ) params.set('q', debouncedQ)
      const res = await fetch(`/api/shipments?${params.toString()}`, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error al cargar')
      setData(body as ApiResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por ID, remitente, destinatario o albarán..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClass}
          />
        </div>
        {canCreate && (
          <Link
            href="/shipments/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo envío
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Remitente</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Destinatario</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Albarán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              ) : !data || data.shipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {debouncedQ
                      ? 'Sin resultados para esa búsqueda'
                      : 'No hay envíos libres todavía. Crea el primero.'}
                  </td>
                </tr>
              ) : (
                data.shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="font-medium text-gray-900 hover:text-gray-700"
                      >
                        {s.shipment_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {formatDate(s.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{s.sender_name}</div>
                      <div className="text-xs text-gray-500">
                        {s.sender_cp} {s.sender_city}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{s.recipient_name}</div>
                      <div className="text-xs text-gray-500">
                        {s.recipient_cp} {s.recipient_city}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <ShipmentStatusBadge status={s.status} />
                        {s.tracking_last_status && (
                          <span className="text-[11px] text-gray-400">
                            TIPSA: {tipsaEventLabel(s.tracking_last_status)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                      {s.albaran ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Página {data.page} de {totalPages} · {data.total} envío{data.total !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
