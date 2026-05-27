'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Loader2 } from 'lucide-react'

interface MessageToHardwarePanelProps {
  orderId: string
}

export default function MessageToHardwarePanel({ orderId }: MessageToHardwarePanelProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setLoading(true)
    setError(null)
    setSent(false)
    try {
      const res = await fetch(`/api/orders/${orderId}/message-to-hardware`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al enviar el mensaje')
      } else {
        setMessage('')
        setSent(true)
        router.refresh()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Mensaje para Hardware</h3>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Añade información posterior al pedido para el equipo de Hardware. Se notificará por Slack.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Escribe tu mensaje..."
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          disabled={loading}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {sent && !error && (
          <p className="text-xs text-emerald-600">Mensaje enviado.</p>
        )}
        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {loading ? 'Enviando...' : 'Enviar a Hardware'}
        </button>
      </form>
    </div>
  )
}
