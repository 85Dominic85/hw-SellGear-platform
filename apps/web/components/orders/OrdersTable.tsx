'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Order, UserRole } from '@/types/database'
import { formatCurrency, formatDate, PURCHASE_TYPE_LABELS } from '@/lib/utils'
import StatusBadge from './StatusBadge'
import { createClient } from '@/lib/supabase/client'

interface OrdersTableProps {
  orders: Order[]
  userRole?: UserRole | null
}

function InvoiceCell({ orderId, value, canEdit }: { orderId: string; value: boolean; canEdit: boolean }) {
  const [invoiced, setInvoiced] = useState(value)
  const [saving, setSaving] = useState(false)

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

export default function OrdersTable({ orders, userRole }: OrdersTableProps) {
  const canEditInvoice = userRole === 'admin' || userRole === 'manager'

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
            {orders.map((order) => (
              <tr
                key={order.id}
                className="group cursor-pointer transition-colors hover:bg-gray-50"
              >
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
