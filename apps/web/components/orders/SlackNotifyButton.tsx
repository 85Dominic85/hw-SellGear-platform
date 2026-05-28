'use client'

import { useState } from 'react'

interface SlackNotifyButtonProps {
  orderId: string
}

const MAX_COMMENT_LENGTH = 500

export default function SlackNotifyButton({ orderId }: SlackNotifyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleNotify() {
    setLoading(true)
    setResult(null)

    try {
      const trimmed = comment.trim()
      const res = await fetch(`/api/orders/${orderId}/notify-slack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: trimmed || undefined }),
      })
      const data = await res.json()

      if (!res.ok) {
        setResult({ type: 'error', text: data.error ?? 'Error al enviar a Slack' })
      } else {
        setResult({ type: 'success', text: 'Notificacion enviada a Slack' })
        setComment('') // limpiar para la siguiente
      }
    } catch {
      setResult({ type: 'error', text: 'Error de conexion. Intentalo de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Slack</h3>
      <p className="mb-3 text-xs text-gray-500">
        Envia la informacion de este pedido y su historial de estados al canal de Slack.
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

      <label
        htmlFor={`slack-comment-${orderId}`}
        className="mb-1 block text-xs font-medium text-gray-700"
      >
        Comentario para Slack (opcional)
      </label>
      <textarea
        id={`slack-comment-${orderId}`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Contexto adicional para el equipo: urgencia, instrucciones, motivo…"
        maxLength={MAX_COMMENT_LENGTH}
        rows={3}
        disabled={loading}
        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#4A154B] focus:outline-none focus:ring-1 focus:ring-[#4A154B] disabled:cursor-not-allowed disabled:bg-gray-50"
      />
      <div className="mb-3 mt-1 text-right text-[10px] text-gray-400">
        {comment.length}/{MAX_COMMENT_LENGTH}
      </div>

      <button
        onClick={handleNotify}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4A154B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#611f69] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" />
          </svg>
        )}
        {loading ? 'Enviando...' : 'Enviar a Slack'}
      </button>
    </div>
  )
}
