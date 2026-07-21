'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { formatEurosCents } from '@/lib/pricing'

interface ManualAdjustmentModalProps {
  orderId: string
  /** Céntimos actualmente aplicados como ajuste manual (0 si ninguno). */
  currentCents: number
  /** Motivo actual (o null). */
  currentReason: string | null
  /** Total c/IVA del pedido ANTES de aplicar el ajuste manual (céntimos).
   *  Se usa para mostrar el total previsto tras el nuevo ajuste. */
  totalBeforeCents: number
  onClose: () => void
}

/**
 * Modal admin para aplicar un ajuste manual (en €) al total del pedido.
 * El ajuste se RESTA al total c/IVA y NO recalcula el IVA declarado.
 * Motivo obligatorio si el ajuste es > 0€.
 */
export default function ManualAdjustmentModal({
  orderId,
  currentCents,
  currentReason,
  totalBeforeCents,
  onClose,
}: ManualAdjustmentModalProps) {
  const router = useRouter()
  const [amountEuros, setAmountEuros] = useState<string>(
    currentCents > 0 ? (currentCents / 100).toFixed(2) : '',
  )
  const [reason, setReason] = useState<string>(currentReason ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escape cierra el modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [loading, onClose])

  // Parseo del importe a céntimos (o null si vacío/inválido).
  const parsedCents: number | null = (() => {
    const trimmed = amountEuros.trim()
    if (trimmed === '') return 0
    const n = Number(trimmed.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return null
    return Math.round(n * 100)
  })()

  const isValid =
    parsedCents !== null &&
    (parsedCents === 0 || reason.trim().length > 0)

  const previewTotalCents =
    parsedCents !== null
      ? Math.max(0, totalBeforeCents - parsedCents)
      : totalBeforeCents

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      if (parsedCents === null) {
        setError('Introduce un importe válido (>= 0).')
        return
      }
      if (parsedCents > 0 && reason.trim().length === 0) {
        setError('Indica un motivo para el ajuste.')
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/orders/${orderId}/manual-adjustment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cents: parsedCents,
            reason: parsedCents > 0 ? reason.trim() : null,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error ?? 'Error al aplicar el ajuste.')
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
    [orderId, parsedCents, reason, router, onClose],
  )

  const handleClear = useCallback(async () => {
    if (currentCents === 0) {
      onClose()
      return
    }
    if (!confirm('¿Retirar el ajuste manual actual?')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/manual-adjustment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cents: 0, reason: null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Error al retirar el ajuste.')
        return
      }
      router.refresh()
      onClose()
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [currentCents, orderId, router, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Ajuste manual del total
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Solo admin · resta un importe fijo al total c/IVA · no recalcula IVA
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          {/* Estado actual */}
          {currentCents > 0 && (
            <div className="rounded-lg bg-brand/5 px-3 py-2 text-xs text-gray-700 ring-1 ring-brand/20">
              <div className="font-medium text-gray-900">
                Ajuste actual: −
                <span className="font-mono tabular-nums">
                  {formatEurosCents(currentCents)}
                </span>
              </div>
              {currentReason && (
                <div className="mt-0.5 text-gray-500">Motivo: {currentReason}</div>
              )}
            </div>
          )}

          {/* Importe */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Importe a restar (€)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={amountEuros}
              onChange={(e) => setAmountEuros(e.target.value)}
              placeholder="0.00"
              disabled={loading}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-gray-50"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Introduce 0 para eliminar el ajuste. Máximo: el propio total del pedido.
            </p>
          </div>

          {/* Motivo */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Motivo
              {parsedCents !== null && parsedCents > 0 && (
                <span className="ml-1 text-red-500">*</span>
              )}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Compensación acuerdo comercial abril · reclamación cliente #123"
              rows={3}
              disabled={loading}
              maxLength={500}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-gray-50"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Obligatorio si el ajuste es &gt; 0€. Queda registrado en el historial de comentarios.
            </p>
          </div>

          {/* Preview del total */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
            <div className="flex items-center justify-between text-gray-500">
              <span>Total actual c/IVA</span>
              <span className="font-mono tabular-nums text-gray-700">
                {formatEurosCents(totalBeforeCents)}
              </span>
            </div>
            {parsedCents !== null && parsedCents > 0 && (
              <div className="mt-1 flex items-center justify-between text-red-500">
                <span>Ajuste manual</span>
                <span className="font-mono tabular-nums">
                  −{formatEurosCents(parsedCents)}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-1 text-sm font-semibold text-gray-900">
              <span>Total tras ajuste</span>
              <span className="font-mono tabular-nums">
                {formatEurosCents(previewTotalCents)}
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-4">
            {currentCents > 0 ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={loading}
                className="rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Retirar ajuste actual
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !isValid}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Guardando…' : 'Guardar ajuste'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
