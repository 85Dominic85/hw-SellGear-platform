'use client'

import type { Product } from '@/types/database'
import { formatEurosCents, taxLabel } from '@/lib/pricing'
import {
  financingBaseTotalCents,
  financingInstallments,
} from '@/lib/financing'
import type { CartLineState } from './CartLine'

interface FinancingSummaryProps {
  lines: CartLineState[]
  products: Product[]
  /** 0 si Canarias (exento), 21 resto. */
  vatRate: number
}

interface RowProps {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}

function Row({ label, value, bold, muted }: RowProps) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? 'text-base font-semibold text-gray-900' : 'text-sm'
      } ${muted ? 'text-gray-500' : 'text-gray-700'}`}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  )
}

/**
 * Desglose económico para pedidos de financiación: total a financiar
 * (c/IVA), plan de 3 pagos y saldo pendiente tras la entrada.
 */
export default function FinancingSummary({
  lines,
  products,
  vatRate,
}: FinancingSummaryProps) {
  const selected = lines.find((l) => l.product_id)
  const product = selected
    ? products.find((p) => p.id === selected.product_id) ?? null
    : null

  if (!product) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500">
        Selecciona un producto financiable para ver el plan de pagos.
      </div>
    )
  }

  const baseTotal = financingBaseTotalCents(product.code) ?? 0
  const installments = financingInstallments(product.code, vatRate) ?? []
  const vatTotal = installments.reduce((s, i) => s + i.vatCents, 0)
  const grossTotal = installments.reduce((s, i) => s + i.grossCents, 0)
  const firstPayment = installments[0]?.grossCents ?? 0
  const pending = grossTotal - firstPayment

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">
        Plan de financiación · {product.name}
      </h3>

      <div className="space-y-1.5">
        <Row label="Base imponible" value={formatEurosCents(baseTotal)} />
        <Row
          label={vatRate > 0 ? taxLabel(vatRate) : 'Exento (Canarias)'}
          value={vatRate > 0 ? `+ ${formatEurosCents(vatTotal)}` : formatEurosCents(0)}
        />
        <div className="my-2 border-t border-gray-200" />
        <Row label="Total a financiar" value={formatEurosCents(grossTotal)} bold />

        <div className="my-3 border-t border-dashed border-gray-200" />

        {installments.map((inst) => (
          <Row
            key={inst.stage}
            label={inst.stage === 1 ? '1er pago (entrada)' : `${inst.stage}.º pago`}
            value={formatEurosCents(inst.grossCents)}
          />
        ))}

        <div className="my-2 border-t border-gray-200" />
        <Row
          label="Pendiente tras la entrada"
          value={formatEurosCents(pending)}
          bold
        />
        <p className="pt-1 text-xs text-gray-400">
          La entrada se abona al confirmar el pedido; los 2 plazos restantes se
          registran desde la ficha del pedido conforme el cliente transfiere.
        </p>
      </div>
    </div>
  )
}
