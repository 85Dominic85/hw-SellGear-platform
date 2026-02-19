'use client'

import { useState } from 'react'

interface SyncButtonProps {
  orderId: string
}

export default function SyncButton({ orderId }: SyncButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch(`/api/orders/${orderId}/sync`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        setResult({ type: 'error', text: data.error ?? 'Error al sincronizar' })
      } else {
        setResult({
          type: 'success',
          text: data.message ?? 'Sincronizado con Google Sheets correctamente',
        })
      }
    } catch {
      setResult({ type: 'error', text: 'Error de conexión. Inténtalo de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Google Sheets</h3>
      <p className="mb-4 text-xs text-gray-500">
        Sincroniza este pedido con la hoja de cálculo de seguimiento.
      </p>

      {result && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-sm ${
            result.type === 'success'
              ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}
        >
          {result.text}
        </div>
      )}

      <button
        onClick={handleSync}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <svg
            className="h-4 w-4 animate-spin text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        )}
        {loading ? 'Sincronizando...' : 'Sincronizar a Google Sheets'}
      </button>
    </div>
  )
}
