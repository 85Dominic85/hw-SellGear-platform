'use client'

import {
  cartTotals,
  effectiveTaxLabel,
  formatEurosCents,
  lineDiscountCents as lineDiscountOf,
  lineSubtotalCents,
} from '@/lib/pricing'
import { isFreePrice } from '@/lib/product-rules'
import type { Product } from '@/types/database'
import type { CartLineState } from './CartLine'

interface CartSummaryProps {
  lines: CartLineState[]
  products: Product[]
  /**
   * Si se provee, sobreescribe vat_rate para todas las lineas en el preview.
   * Lo usa NewOrderPage para mostrar IGIC 7 % cuando el shipping_cp es canario.
   * Es solo preview UI; el servidor recalcula al insertar.
   */
  vatRateOverride?: number | null
  /**
   * Descuento global (%) del pedido. Se aplica sobre la base imponible
   * agregada, prorrateado por línea antes del IVA. Se muestra como fila
   * "Descuento global" y modifica el TOTAL. Si el callback está presente,
   * se renderiza un input editable dentro del resumen.
   */
  discountGlobalPct?: number
  onDiscountGlobalChange?: (pct: number) => void
}

interface RowProps {
  label: React.ReactNode
  value: React.ReactNode
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

export default function CartSummary({
  lines,
  products,
  vatRateOverride = null,
  discountGlobalPct = 0,
  onDiscountGlobalChange,
}: CartSummaryProps) {
  const productById = new Map(products.map((p) => [p.id, p]))

  // Detalle por línea (con nombre) para el desglose de descuentos.
  const detailed = lines
    .map((l) => {
      const p = l.product_id ? productById.get(l.product_id) ?? null : null
      if (!p) return null
      // Productos con precio libre (override obligatorio en el carrito).
      const priceCents = isFreePrice(p)
        ? l.unit_price_override_cents ?? 0
        : p.price_cents
      const displayName =
        l.product_name_override.trim() || p.name || '(sin nombre)'
      // Mismos helpers que usa cartTotals, para que el desglose por línea no
      // pueda desviarse del total por un redondeo distinto.
      const subtotalCents = lineSubtotalCents(priceCents, l.qty)
      const lineDiscountCents = lineDiscountOf(priceCents, l.qty, l.discount_pct)
      return {
        name: displayName,
        priceCents,
        qty: l.qty,
        discountPct: l.discount_pct,
        vatRate: vatRateOverride ?? Number(p.vat_rate),
        packageCount: p.package_count,
        subtotalCents,
        lineDiscountCents,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const computed = detailed.map((d) => ({
    priceCents: d.priceCents,
    qty: d.qty,
    discountPct: d.discountPct,
    vatRate: d.vatRate,
  }))

  const totals = cartTotals(computed, discountGlobalPct)
  const totalPackages = detailed.reduce(
    (sum, l) => sum + l.qty * l.packageCount,
    0,
  )
  const editable = typeof onDiscountGlobalChange === 'function'
  // Líneas con descuento aplicado > 0 (para el desglose visible).
  const discountedLines = detailed.filter((d) => d.lineDiscountCents > 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Total del pedido</h3>
      <div className="space-y-1.5">
        <Row label="Subtotal s/IVA" value={formatEurosCents(totals.subtotalCents)} />
        {totals.lineDiscountCents > 0 && (
          <>
            <Row
              label="Descuentos por línea"
              value={`− ${formatEurosCents(totals.lineDiscountCents)}`}
            />
            {/* Sub-desglose: nombre + descuento por línea (solo las que tienen dto>0) */}
            <div className="ml-3 space-y-0.5 border-l border-gray-200 pl-3">
              {discountedLines.map((d, i) => {
                const isGift = d.discountPct === 100
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs text-gray-500"
                  >
                    <span className="truncate">
                      {isGift ? '🎁 ' : '↳ '}
                      {d.name}{' '}
                      <span className="text-gray-400">
                        ({d.discountPct}
                        {isGift ? '% · regalo' : '%'})
                      </span>
                    </span>
                    <span className="ml-3 whitespace-nowrap font-mono tabular-nums">
                      − {formatEurosCents(d.lineDiscountCents)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Descuento global editable (o solo lectura si no hay callback) */}
        {(editable || totals.globalDiscountCents > 0) && (
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>Descuento global (%)</span>
            <div className="flex items-center gap-2">
              {editable ? (
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={discountGlobalPct}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10)
                    const clamped = Number.isFinite(raw)
                      ? Math.max(0, Math.min(100, raw))
                      : 0
                    onDiscountGlobalChange!(clamped)
                  }}
                  className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-right font-mono text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  title="Descuento global sobre la base imponible del pedido (0-100)"
                />
              ) : (
                <span className="text-sm text-gray-700">{discountGlobalPct}%</span>
              )}
              <span className="font-mono tabular-nums text-red-500">
                {totals.globalDiscountCents > 0
                  ? `− ${formatEurosCents(totals.globalDiscountCents)}`
                  : '—'}
              </span>
            </div>
          </div>
        )}

        <Row
          label="Base imponible"
          value={formatEurosCents(totals.taxableCents)}
        />
        <Row
          label={effectiveTaxLabel(computed.map((c) => c.vatRate))}
          value={`+ ${formatEurosCents(totals.vatCents)}`}
        />
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
