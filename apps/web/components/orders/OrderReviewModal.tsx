'use client'

import { useEffect } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import type { Product, PurchaseType } from '@/types/database'
import { cartTotals, formatEurosCents, effectiveTaxLabel } from '@/lib/pricing'
import { PURCHASE_TYPE_LABELS, isCanaryIslands } from '@/lib/utils'
import type { CartLineState } from './CartLine'

interface FormSnapshot {
  requester_name: string
  requester_email: string
  customer_name: string
  venue_name: string
  contact_email: string
  phone: string
  purchase_type: PurchaseType | ''
  hubspot_ref: string
  bank_receipt_url: string
  shipping_street: string
  shipping_cp: string
  shipping_city: string
  shipping_province: string
  notes: string
}

interface OrderReviewModalProps {
  form: FormSnapshot
  items: CartLineState[]
  products: Product[]
  discountGlobalPct: number
  requiresShipping: boolean
  saving: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Popup de revisión final antes de crear el pedido. Muestra el
 * resumen completo (solicitante, cliente, envío, productos y totales)
 * para que el AE verifique todo antes de confirmar. Solo el botón
 * "Confirmar y crear pedido" dispara el POST.
 */
export default function OrderReviewModal({
  form,
  items,
  products,
  discountGlobalPct,
  requiresShipping,
  saving,
  error,
  onCancel,
  onConfirm,
}: OrderReviewModalProps) {
  // Escape cierra si no está guardando.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  const productById = new Map(products.map((p) => [p.id, p]))
  const vatOverride = isCanaryIslands(form.shipping_cp) ? 0 : null

  const filled = items.filter((it) => it.product_id)
  // Detalle por línea con nombre + descuento en euros (para el sub-desglose).
  const detailed = filled
    .map((l) => {
      const p = l.product_id ? productById.get(l.product_id) ?? null : null
      if (!p) return null
      const priceCents =
        p.code === 'otro' ||
        p.category === 'saas_hardware' ||
        p.code === 'implementacion-pro' ||
        p.code === 'software-qamarero'
          ? l.unit_price_override_cents ?? 0
          : p.price_cents
      const displayName =
        l.product_name_override.trim() || p.name || '(sin nombre)'
      const subtotalCents = priceCents * l.qty
      const lineDiscountCents = Math.round(
        subtotalCents * (l.discount_pct / 100),
      )
      return {
        name: displayName,
        priceCents,
        qty: l.qty,
        discountPct: l.discount_pct,
        vatRate: vatOverride ?? Number(p.vat_rate),
        subtotalCents,
        lineDiscountCents,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const linesForTotals = detailed.map((d) => ({
    priceCents: d.priceCents,
    qty: d.qty,
    discountPct: d.discountPct,
    vatRate: d.vatRate,
  }))

  const totals = cartTotals(linesForTotals, discountGlobalPct)
  const vatRates = linesForTotals.map((l) => l.vatRate)
  const discountedLines = detailed.filter((d) => d.lineDiscountCents > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !saving && onCancel()}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Revisa el pedido antes de crearlo
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Última comprobación. Si algo no cuadra, vuelve atrás a editar.
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5">
          {/* Tipo de compra */}
          <Section title="Tipo de compra">
            <span className="text-sm font-medium text-gray-900">
              {form.purchase_type
                ? PURCHASE_TYPE_LABELS[form.purchase_type as PurchaseType] ??
                  form.purchase_type
                : '—'}
            </span>
          </Section>

          {/* Solicitante */}
          <Section title="Solicitante">
            <KV label="Nombre" value={form.requester_name || '—'} />
            <KV label="Email" value={form.requester_email || '—'} />
          </Section>

          {/* Cliente */}
          <Section title="Cliente">
            <KV label="Nombre" value={form.customer_name || '—'} />
            {form.venue_name && <KV label="Venue / local" value={form.venue_name} />}
            <KV label="Email" value={form.contact_email || '—'} />
            {form.phone && <KV label="Teléfono" value={form.phone} />}
          </Section>

          {/* Envío */}
          {requiresShipping && (
            <Section title="Envío">
              <KV
                label="Dirección"
                value={
                  [form.shipping_street, form.shipping_cp, form.shipping_city]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />
              {form.shipping_province && (
                <KV label="Provincia" value={form.shipping_province} />
              )}
              {isCanaryIslands(form.shipping_cp) && (
                <p className="mt-1 text-xs text-brand">
                  📍 Canarias: exento de IVA (0 %).
                </p>
              )}
            </Section>
          )}

          {/* Referencias */}
          {(form.hubspot_ref || form.bank_receipt_url) && (
            <Section title="Referencias">
              {form.hubspot_ref && <KV label="HubSpot" value={form.hubspot_ref} />}
              {form.bank_receipt_url && (
                <KV
                  label="Justificante"
                  value={
                    <a
                      href={form.bank_receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline break-all"
                    >
                      Ver documento ↗
                    </a>
                  }
                />
              )}
            </Section>
          )}

          {/* Notas */}
          {form.notes && (
            <Section title="Notas internas">
              <p className="whitespace-pre-line text-sm text-gray-700">
                {form.notes}
              </p>
            </Section>
          )}

          {/* Productos */}
          <Section title={`Productos (${filled.length})`}>
            {filled.length === 0 ? (
              <p className="text-sm italic text-gray-400">Sin productos.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filled.map((line, i) => {
                  const p = line.product_id
                    ? productById.get(line.product_id) ?? null
                    : null
                  const isFreePrice =
                    p?.code === 'otro' ||
                    p?.category === 'saas_hardware' ||
                    p?.code === 'implementacion-pro' ||
                    p?.code === 'software-qamarero'
                  const displayName =
                    line.product_name_override.trim() || p?.name || '(sin nombre)'
                  const unitPriceCents = isFreePrice
                    ? line.unit_price_override_cents ?? 0
                    : p?.price_cents ?? 0
                  const subtotal = unitPriceCents * line.qty
                  return (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">
                          {displayName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {line.qty} × {formatEurosCents(unitPriceCents)}
                          {line.discount_pct > 0 &&
                            ` · Descuento ${line.discount_pct}%`}
                        </p>
                      </div>
                      <span className="font-mono text-sm text-gray-900 tabular-nums">
                        {formatEurosCents(subtotal)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          {/* Totales */}
          {filled.length > 0 && (
            <Section title="Totales">
              <TotalRow
                label="Subtotal s/IVA"
                value={formatEurosCents(totals.subtotalCents)}
              />
              {totals.lineDiscountCents > 0 && (
                <>
                  <TotalRow
                    label="Descuentos por línea"
                    value={`− ${formatEurosCents(totals.lineDiscountCents)}`}
                    muted
                  />
                  {/* Sub-desglose: nombre + descuento por línea */}
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
              {totals.globalDiscountCents > 0 && (
                <TotalRow
                  label={`Descuento global (${discountGlobalPct}%)`}
                  value={`− ${formatEurosCents(totals.globalDiscountCents)}`}
                  muted
                />
              )}
              <TotalRow
                label="Base imponible"
                value={formatEurosCents(totals.taxableCents)}
                muted
              />
              <TotalRow
                label={effectiveTaxLabel(vatRates)}
                value={`+ ${formatEurosCents(totals.vatCents)}`}
                muted
              />
              <div className="my-1 border-t border-gray-200" />
              <TotalRow
                label="TOTAL c/IVA"
                value={formatEurosCents(totals.totalCents)}
                bold
              />
            </Section>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            ← Volver a editar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {saving ? 'Creando pedido…' : 'Confirmar y crear pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h3>
      <div className="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
        {children}
      </div>
    </div>
  )
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="min-w-0 flex-1 text-right text-gray-900">{value}</span>
    </div>
  )
}

function TotalRow({
  label,
  value,
  bold,
  muted,
}: {
  label: React.ReactNode
  value: React.ReactNode
  bold?: boolean
  muted?: boolean
}) {
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
