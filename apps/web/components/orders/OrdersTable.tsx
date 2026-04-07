'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Order, OrderItem, UserRole } from '@/types/database'
import { formatCurrency, formatDate, PURCHASE_TYPE_LABELS, isCanaryIslands } from '@/lib/utils'
import StatusBadge from './StatusBadge'
import { createClient } from '@/lib/supabase/client'
import { Eye, X, MapPin, Package, FileText, Phone, Mail, Truck } from 'lucide-react'

interface OrdersTableProps {
  orders: Order[]
  userRole?: UserRole | null
}

function InvoiceCell({ orderId, value, canEdit }: { orderId: string; value: boolean; canEdit: boolean }) {
  const [invoiced, setInvoiced] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setInvoiced(value) }, [value])

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canEdit || saving) return

    const newValue = !invoiced
    setInvoiced(newValue)
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ invoiced: newValue })
      .eq('id', orderId)

    setSaving(false)
    if (error) setInvoiced(!newValue)
  }

  if (!canEdit) {
    return (
      <span className={`text-sm ${invoiced ? 'text-green-600' : 'text-gray-400'}`}>
        {invoiced ? 'Si' : '—'}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      className="flex items-center justify-center disabled:opacity-50"
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
          invoiced
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-300 bg-white text-transparent hover:border-gray-400'
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    </button>
  )
}

function OrderDetailPopup({ order, onClose }: { order: Order; onClose: () => void }) {
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const items = order.order_items ?? []
  const hasContact = order.shipping_address || order.contact_email || order.phone
  const hasItems = items.length > 0
  const hasNotes = !!order.notes

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        ref={popupRef}
        className="relative mx-4 w-full max-w-lg rounded-xl bg-white shadow-2xl ring-1 ring-gray-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Detalle de envio
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 font-mono">{order.operation_id}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-5">
          {/* Contacto / Dirección */}
          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <MapPin className="h-4 w-4 text-blue-500" />
              Direccion de contacto
              {isCanaryIslands(order.shipping_address) && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Canarias</span>
              )}
            </div>
            {hasContact ? (
              <div className="space-y-1.5 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {order.shipping_address && (
                  <p>{order.shipping_address}</p>
                )}
                {order.contact_email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    {order.contact_email}
                  </p>
                )}
                {order.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    {order.phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm italic text-gray-400">Sin datos de contacto</p>
            )}
          </section>

          {/* Artículos */}
          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Package className="h-4 w-4 text-purple-500" />
              Articulos ({items.length})
            </div>
            {hasItems ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Ud.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Precio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item: OrderItem) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-gray-700">{item.product_name}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{item.qty}</td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {item.unit_price != null ? formatCurrency(item.unit_price) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm italic text-gray-400">Sin articulos registrados</p>
            )}
          </section>

          {/* Notas */}
          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="h-4 w-4 text-amber-500" />
              Notas
            </div>
            {hasNotes ? (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm whitespace-pre-wrap text-gray-600">
                {order.notes}
              </div>
            ) : (
              <p className="text-sm italic text-gray-400">Sin notas</p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 text-right">
          <Link
            href={`/orders/${order.id}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Ver ficha completa →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function OrdersTable({ orders, userRole }: OrdersTableProps) {
  const canEditInvoice = userRole === 'admin' || userRole === 'manager'
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [shippingLabelUrl, setShippingLabelUrl] = useState<string | null>(null)

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
        <svg
          className="mb-4 h-12 w-12 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="text-sm font-medium text-gray-500">No hay pedidos</p>
        <p className="mt-1 text-xs text-gray-400">
          Ajusta los filtros o crea un nuevo pedido.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-1 p-0"><span className="sr-only">Estado envio</span></th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Local
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Tipo
              </th>
              <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span className="sr-only">Detalle</span>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Importe
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                Fact.
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Ref AE
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => {
              const isFullyComplete = order.prepared && order.shipped && !!order.shipping_label_url
              return (
              <tr
                key={order.id}
                className="group cursor-pointer transition-colors hover:bg-gray-50"
              >
                <td className={`w-1 p-0 ${isFullyComplete ? 'bg-gradient-to-b from-blue-500 to-green-500' : ''}`} />
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={`/orders/${order.id}`}
                    className="block text-sm font-mono font-medium text-gray-900 hover:text-blue-600"
                  >
                    {order.operation_id}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/orders/${order.id}`} className="block">
                    <span className="text-sm text-gray-900">{order.customer_name}</span>
                    {isCanaryIslands(order.shipping_address) && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Canarias</span>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/orders/${order.id}`} className="block">
                    <span className="text-sm text-gray-500">
                      {order.venue_name ?? '—'}
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/orders/${order.id}`} className="block">
                    <span className="text-sm text-gray-500">
                      {order.purchase_type
                        ? PURCHASE_TYPE_LABELS[order.purchase_type]
                        : '—'}
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-center">
                  <div className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDetailOrder(order)
                      }}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      title="Ver detalle de envio"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {isFullyComplete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setShippingLabelUrl(order.shipping_label_url)
                        }}
                        className="group/ship rounded-md p-1.5 text-green-500 transition-colors hover:bg-green-50 hover:text-green-700"
                        title="Ver etiqueta de envio"
                      >
                        <Truck className="h-4 w-4 transition-all group-hover/ship:hidden" />
                        <Package className="hidden h-4 w-4 transition-all group-hover/ship:block" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link href={`/orders/${order.id}`} className="block">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(order.amount)}
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <InvoiceCell orderId={order.id} value={order.invoiced} canEdit={canEditInvoice} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/orders/${order.id}`} className="block">
                    <StatusBadge status={order.status} />
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/orders/${order.id}`} className="block">
                    <span className="text-sm text-gray-500">
                      {formatDate(order.created_at)}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/orders/${order.id}`} className="block">
                    <span className="text-sm text-gray-500">
                      {order.ae_ref ?? '—'}
                    </span>
                  </Link>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detailOrder && (
        <OrderDetailPopup
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      )}

      {shippingLabelUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShippingLabelUrl(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShippingLabelUrl(null)
          }}
        >
          <div className="relative mx-4 flex h-[80vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Etiqueta de envio</h3>
              <button
                type="button"
                onClick={() => setShippingLabelUrl(null)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={shippingLabelUrl}
                className="h-full w-full border-0"
                title="Etiqueta de envio"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
