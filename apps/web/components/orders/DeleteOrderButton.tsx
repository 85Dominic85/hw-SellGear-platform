'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteOrderButtonProps {
  orderId: string
  operationId: string
}

export default function DeleteOrderButton({ orderId, operationId }: DeleteOrderButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? 'Error al eliminar el pedido')
        setDeleting(false)
        setConfirming(false)
        return
      }

      router.push('/orders')
      router.refresh()
    } catch {
      alert('Error de conexion. Intentalo de nuevo.')
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Eliminar pedido</h3>
        <p className="mb-3 text-xs text-gray-500">
          Elimina este pedido y todos sus datos asociados de forma permanente.
        </p>
        <button
          onClick={() => setConfirming(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Eliminar pedido
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-red-800">Confirmar eliminacion</h3>
      <p className="mb-3 text-xs text-red-600">
        Se eliminara permanentemente el pedido <strong>{operationId}</strong> junto con sus articulos, comentarios e historial.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Eliminando...' : 'Si, eliminar'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
