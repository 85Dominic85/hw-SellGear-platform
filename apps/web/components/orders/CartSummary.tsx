'use client'

import { cartTotals, formatEurosCents } from '@/lib/pricing'
import type { Product } from '@/types/database'
import type { CartLineState } from './CartLine'

interface CartSummaryProps {
  lines: CartLineState[]
  products: Product[]
}

interface RowProps {
  label: string
  value: string
  bold?: boolean
  highlight?: boolean
}

function Row({ label, value, bold, highlight }: RowProps) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? 'text-base font-semibold' : 'text-sm'
      } ${highlight ? 'text-gray-900' : 'text-gray-700'}`}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  )
}

export default function CartSummary({ lines, products }: CartSummaryProps) {
  const productById = new Map(products.map((p) => [p.id, p]))

  const computed = lines
    .map((l) => {
      const p = l.product_id ? productById.get(l.product_id) ?? null : null
      if (!p) return null
      const priceCents =
        p.code === 'otro' ? l.unit_price_override_cents ?? 0 : p.price_cents
      return {
        priceCents,
        qty: l.qty,
        discountPct: l.discount_pct,
        vatRate: Number(p.vat_rate),
        packageCount: p.package_count,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const totals = cartTotals(computed)
  const totalPackages = computed.reduce(
    (sum, l) => sum + l.qty * l.packageCount,
    0,
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Total del pedido</h3>
      <div className="space-y-1.5">
        <Row label="Subtotal s/IVA" value={formatEurosCents(totals.subtotalCents)} />
        {totals.discountCents > 0 && (
          <Row
            label="Descuentos"
            value={`- ${formatEurosCents(totals.discountCents)}`}
          />
        )}
        <Row
          label="Base imponible"
          value={formatEurosCents(totals.taxableCents)}
        />
        <Row label="IVA (21 %)" value={`+ ${formatEurosCents(totals.vatCents)}`} />
        <div className="my-2 border-t border-gray-200" />
        <Row
          label="TOTAL"
          value={formatEurosCents(totals.totalCents)}
          bold
          highlight
        />
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span>Bultos TIPSA (estimado)</span>
          <span className="font-mono tabular-nums">{totalPackages}</span>
        </div>
      </div>
    </div>
  )
}
