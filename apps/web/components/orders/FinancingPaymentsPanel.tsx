'use client'

import { useRef, useState } from 'react'
import { Paperclip, Loader2, Check, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatEurosCents } from '@/lib/pricing'
import { formatDate } from '@/lib/utils'
import type { OrderPayment } from '@/types/database'
import FinancingProgressBadge from './FinancingProgressBadge'

const ACCEPTED = '.pdf,.png,.jpg,.jpeg'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

interface FinancingPaymentsPanelProps {
  orderId: string
  initialPayments: OrderPayment[]
  canEdit: boolean
}

function stageLabel(n: number): string {
  return n === 1 ? '1er pago (entrada)' : `${n}.º pago`
}

export default function FinancingPaymentsPanel({
  orderId,
  initialPayments,
  canEdit,
}: FinancingPaymentsPanelProps) {
  const [payments, setPayments] = useState<OrderPayment[]>(
    [...initialPayments].sort((a, b) => a.installment_no - b.installment_no),
  )
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  async function patchPayment(
    installmentNo: number,
    patch: Partial<Pick<OrderPayment, 'status' | 'paid_at' | 'receipt_url'>>,
  ) {
    setBusy(installmentNo)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/payments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installment_no: installmentNo, ...patch }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al actualizar el pago.')
      setPayments((prev) =>
        prev.map((p) => (p.installment_no === installmentNo ? (data.payment as OrderPayment) : p)),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar el pago.')
    } finally {
      setBusy(null)
    }
  }

  async function generatePlan() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/payments`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al generar el plan.')
      setPayments(
        ((data.payments ?? []) as OrderPayment[]).sort(
          (a, b) => a.installment_no - b.installment_no,
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar el plan.')
    } finally {
      setGenerating(false)
    }
  }

  async function uploadReceipt(installmentNo: number, file: File) {
    if (file.size > MAX_SIZE) {
      setError('Archivo demasiado grande (máx. 10 MB).')
      return
    }
    setBusy(installmentNo)
    setError(null)
    try {
      const supabase = createClient()
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${orderId}/payment-${installmentNo}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage
        .from('order-attachments')
        .upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('order-attachments').getPublicUrl(path)
      await patchPayment(installmentNo, { receipt_url: data.publicUrl })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir el justificante.')
      setBusy(null)
    }
  }

  const totalGross = payments.reduce((s, p) => s + p.amount_cents, 0)
  const paidGross = payments
    .filter((p) => p.status === 'pagado')
    .reduce((s, p) => s + p.amount_cents, 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Plan de pagos (financiación)</h3>
        <FinancingProgressBadge payments={payments} />
      </div>

      {payments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Este pedido de financiación no tiene plan de pagos registrado.
          {canEdit && (
            <div className="mt-3">
              <button
                type="button"
                onClick={generatePlan}
                disabled={generating}
                className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {generating ? 'Generando…' : 'Generar plan de pagos'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Plazo</th>
                  <th className="py-2 pr-3 text-right">Importe</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Justificante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    canEdit={canEdit}
                    busy={busy === p.installment_no}
                    onToggle={() =>
                      patchPayment(p.installment_no, {
                        status: p.status === 'pagado' ? 'pendiente' : 'pagado',
                      })
                    }
                    onDate={(iso) => patchPayment(p.installment_no, { paid_at: iso })}
                    onUpload={(file) => uploadReceipt(p.installment_no, file)}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 text-sm font-medium text-gray-900">
                  <td className="py-2 pr-3">Total</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {formatEurosCents(totalGross)}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-500" colSpan={3}>
                    Cobrado: {formatEurosCents(paidGross)} · Pendiente:{' '}
                    {formatEurosCents(totalGross - paidGross)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  )
}

interface PaymentRowProps {
  payment: OrderPayment
  canEdit: boolean
  busy: boolean
  onToggle: () => void
  onDate: (iso: string) => void
  onUpload: (file: File) => void
}

function PaymentRow({ payment, canEdit, busy, onToggle, onDate, onUpload }: PaymentRowProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const isPaid = payment.status === 'pagado'

  return (
    <tr className="text-gray-700">
      <td className="py-3 pr-3 font-medium text-gray-900">{stageLabel(payment.installment_no)}</td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums">
        {formatEurosCents(payment.amount_cents)}
      </td>
      <td className="py-3 pr-3">
        {canEdit ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              isPaid
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : isPaid && <Check className="h-3 w-3" />}
            {isPaid ? 'Pagado' : 'Pendiente'}
          </button>
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isPaid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {isPaid ? 'Pagado' : 'Pendiente'}
          </span>
        )}
      </td>
      <td className="py-3 pr-3">
        {canEdit ? (
          <input
            type="date"
            value={payment.paid_at ? payment.paid_at.slice(0, 10) : ''}
            onChange={(e) =>
              onDate(e.target.value ? new Date(e.target.value).toISOString() : '')
            }
            disabled={busy}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-brand focus:outline-none disabled:opacity-50"
          />
        ) : (
          <span className="text-xs text-gray-500">
            {payment.paid_at ? formatDate(payment.paid_at) : '—'}
          </span>
        )}
      </td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          {payment.receipt_url && (
            <a
              href={payment.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Ver <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                title="Adjuntar justificante (PDF o imagen)"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                {payment.receipt_url ? 'Cambiar' : 'Adjuntar'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) onUpload(f)
                }}
                className="hidden"
              />
            </>
          )}
          {!payment.receipt_url && !canEdit && <span className="text-xs text-gray-400">—</span>}
        </div>
      </td>
    </tr>
  )
}
