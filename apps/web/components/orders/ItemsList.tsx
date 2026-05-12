'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { OrderItem } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import {
  effectiveTaxLabel,
  formatEurosCents,
  lineDiscountCents,
  lineSubtotalCents,
  lineTaxableCents,
  lineTotalCents,
  lineVatCents,
  taxLabel,
} from '@/lib/pricing'

interface ItemsListProps {
  orderId: string
  items: OrderItem[]
  readOnly?: boolean
}

interface NewItem {
  product_name: string
  qty: number
  unit_price: string
  notes: string
}

const EMPTY_ITEM: NewItem = { product_name: '', qty: 1, unit_price: '', notes: '' }

interface LineBreakdown {
  hasModernPricing: boolean
  unitPriceCents: number
  discountPct: number
  vatRate: number
  subtotalCents: number
  discountCents: number
  taxableCents: number
  taxCents: number
  totalCents: number
}

function computeBreakdown(item: OrderItem): LineBreakdown {
  const unitPriceCents = item.unit_price_cents
  const hasModernPricing = unitPriceCents !== null && unitPriceCents !== undefined
  if (!hasModernPricing) {
    return {
      hasModernPricing: false,
      unitPriceCents: 0,
      discountPct: 0,
      vatRate: 0,
      subtotalCents: 0,
      discountCents: 0,
      taxableCents: 0,
      taxCents: 0,
      totalCents: 0,
    }
  }
  const discountPct = Number(item.discount_pct ?? 0)
  const vatRate = Number(item.vat_rate ?? 21)
  return {
    hasModernPricing: true,
    unitPriceCents: unitPriceCents as number,
    discountPct,
    vatRate,
    subtotalCents: lineSubtotalCents(unitPriceCents as number, item.qty),
    discountCents: lineDiscountCents(unitPriceCents as number, item.qty, discountPct),
    taxableCents: lineTaxableCents(unitPriceCents as number, item.qty, discountPct),
    taxCents: lineVatCents(unitPriceCents as number, item.qty, discountPct, vatRate),
    totalCents: lineTotalCents(unitPriceCents as number, item.qty, discountPct, vatRate),
  }
}

export default function ItemsList({ orderId, items, readOnly }: ItemsListProps) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState<NewItem>(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Pre-calculo desglose por linea para no recomputar en render y para el tfoot
  const breakdowns = useMemo(
    () => items.map((it) => ({ item: it, b: computeBreakdown(it) })),
    [items],
  )

  const totals = useMemo(() => {
    const modern = breakdowns.filter((x) => x.b.hasModernPricing)
    return {
      hasAny: modern.length > 0,
      hasMixedLegacy: modern.length > 0 && modern.length < breakdowns.length,
      subtotal: modern.reduce((s, x) => s + x.b.subtotalCents, 0),
      discount: modern.reduce((s, x) => s + x.b.discountCents, 0),
      taxable: modern.reduce((s, x) => s + x.b.taxableCents, 0),
      tax: modern.reduce((s, x) => s + x.b.taxCents, 0),
      total: modern.reduce((s, x) => s + x.b.totalCents, 0),
      rates: modern.map((x) => x.b.vatRate),
    }
  }, [breakdowns])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.product_name.trim()) return

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('order_items').insert({
      order_id: orderId,
      product_name: newItem.product_name.trim(),
      qty: newItem.qty,
      unit_price: newItem.unit_price ? parseFloat(newItem.unit_price) : null,
      notes: newItem.notes.trim() || null,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setNewItem(EMPTY_ITEM)
      setAdding(false)
      router.refresh()
    }

    setSaving(false)
  }

  async function handleDelete(itemId: string) {
    if (!confirm('¿Eliminar este artículo?')) return

    setDeletingId(itemId)
    setError(null)

    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('id', itemId)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      router.refresh()
    }

    setDeletingId(null)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Artículos ({items.length})
        </h3>
        {!adding && !readOnly && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Añadir artículo
          </button>
        )}
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {items.length === 0 && !adding ? (
        <p className="px-5 py-6 text-sm text-gray-400 italic">Sin artículos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Producto
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Cant.
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  P. Unit. s/IVA
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Desc.
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Base
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Impuesto
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Total c/IVA
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Notas
                </th>
                {!readOnly && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {breakdowns.map(({ item, b }) => (
                <tr key={item.id} className="group">
                  <td className="px-5 py-3 text-sm text-gray-900">
                    {item.product_name ?? '(sin nombre)'}
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-gray-700">
                    {item.qty}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-700 font-mono tabular-nums">
                    {b.hasModernPricing
                      ? formatEurosCents(b.unitPriceCents)
                      : formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-700">
                    {b.hasModernPricing
                      ? b.discountPct > 0
                        ? `${b.discountPct}%`
                        : '—'
                      : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-700 font-mono tabular-nums">
                    {b.hasModernPricing ? formatEurosCents(b.taxableCents) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-700">
                    {b.hasModernPricing ? (
                      <span className="font-mono tabular-nums">
                        {formatEurosCents(b.taxCents)}
                      </span>
                    ) : (
                      '—'
                    )}
                    {b.hasModernPricing && (
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">
                        {taxLabel(b.vatRate)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900 font-mono tabular-nums">
                    {b.hasModernPricing ? formatEurosCents(b.totalCents) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.notes ?? '—'}
                  </td>
                  {!readOnly && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="rounded p-1 text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed"
                        title="Eliminar artículo"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {/* Add new item row */}
              {adding && (
                <tr className="bg-blue-50/50">
                  <td className="px-5 py-2">
                    <input
                      type="text"
                      value={newItem.product_name}
                      onChange={(e) =>
                        setNewItem((p) => ({ ...p, product_name: e.target.value }))
                      }
                      placeholder="Nombre del producto"
                      autoFocus
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={newItem.qty}
                      onChange={(e) =>
                        setNewItem((p) => ({
                          ...p,
                          qty: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={newItem.unit_price}
                      onChange={(e) =>
                        setNewItem((p) => ({ ...p, unit_price: e.target.value }))
                      }
                      placeholder="0.00"
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-400">—</td>
                  <td className="px-3 py-2 text-center text-xs text-gray-400">—</td>
                  <td className="px-3 py-2 text-center text-xs text-gray-400">—</td>
                  <td className="px-3 py-2 text-center text-xs text-gray-400">—</td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={newItem.notes}
                      onChange={(e) =>
                        setNewItem((p) => ({ ...p, notes: e.target.value }))
                      }
                      placeholder="Notas opcionales"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAdd}
                        disabled={saving || !newItem.product_name.trim()}
                        className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                      >
                        {saving ? '...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => {
                          setAdding(false)
                          setNewItem(EMPTY_ITEM)
                        }}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {totals.hasAny && (
              <tfoot className="bg-gray-50/60 border-t border-gray-200">
                <tr>
                  <td
                    className="px-5 py-2 text-right text-xs font-medium text-gray-500"
                    colSpan={4}
                  >
                    Totales
                    {totals.hasMixedLegacy && (
                      <span className="ml-2 text-[10px] text-gray-400 italic normal-case">
                        (solo líneas con desglose)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium text-gray-700 font-mono tabular-nums">
                    {formatEurosCents(totals.taxable)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium text-gray-700 font-mono tabular-nums">
                    {formatEurosCents(totals.tax)}
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">
                      {effectiveTaxLabel(totals.rates)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-900 font-mono tabular-nums">
                    {formatEurosCents(totals.total)}
                  </td>
                  <td />
                  {!readOnly && <td />}
                </tr>
                {totals.discount > 0 && (
                  <tr>
                    <td
                      className="px-5 py-1 text-right text-[11px] text-gray-400"
                      colSpan={4}
                    >
                      Subtotal s/IVA · Descuentos aplicados
                    </td>
                    <td
                      className="px-3 py-1 text-right text-[11px] text-gray-500 font-mono tabular-nums"
                      colSpan={2}
                    >
                      {formatEurosCents(totals.subtotal)} ·{' '}
                      <span className="text-red-500">
                        −{formatEurosCents(totals.discount)}
                      </span>
                    </td>
                    <td />
                    <td />
                    {!readOnly && <td />}
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
