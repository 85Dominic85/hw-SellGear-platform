'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { AddressBookEntry } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

interface AddressBookTableProps {
  canEdit: boolean
}

interface ApiResponse {
  entries: AddressBookEntry[]
  total: number
  page: number
  limit: number
}

const PAGE_SIZE = 20

export default function AddressBookTable({ canEdit }: AddressBookTableProps) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounce 250ms para no spamear el endpoint mientras se teclea.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250)
    return () => clearTimeout(t)
  }, [q])

  // Reset a pagina 1 cuando cambia la query.
  useEffect(() => {
    setPage(1)
  }, [debouncedQ])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (debouncedQ) params.set('q', debouncedQ)
      const res = await fetch(`/api/address-book?${params.toString()}`, { cache: 'no-store' })
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
    fetchEntries()
  }, [fetchEntries])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre, local, dirección, CP, ciudad..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClass}
          />
        </div>
        {canEdit && (
          <Link
            href="/address-book/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva direccion
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
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre / Local</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Dirección</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">CP / Ciudad</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Contacto</th>
                {canEdit && <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              ) : !data || data.entries.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-gray-400">
                    {debouncedQ ? 'Sin resultados para esa búsqueda' : 'La agenda está vacía. Crea la primera dirección.'}
                  </td>
                </tr>
              ) : (
                data.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{entry.name}</div>
                      {entry.venue_name && <div className="text-xs text-gray-500">{entry.venue_name}</div>}
                      {entry.alias && <div className="text-[11px] text-gray-400 italic">{entry.alias}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.address}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{entry.cp}</div>
                      <div className="text-xs text-gray-500">
                        {entry.city}
                        {entry.province ? ` (${entry.province})` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {entry.contact_person && <div>{entry.contact_person}</div>}
                      {entry.phone && <div className="text-xs text-gray-500">{entry.phone}</div>}
                      {entry.email && <div className="text-xs text-gray-500">{entry.email}</div>}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/address-book/${entry.id}/edit`}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Editar
                        </Link>
                      </td>
                    )}
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
            Página {data.page} de {totalPages} · {data.total} resultado{data.total !== 1 ? 's' : ''}
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
