'use client'

import Link from 'next/link'
import type { Order } from '@/types/database'
import { formatCurrency, formatDate, PURCHASE_TYPE_LABELS } from '@/lib/utils'
import StatusBadge from './StatusBadge'

interface OrdersTableProps {
  orders: Order[]
}

export default function OrdersTable({ orders }: OrdersTableProps) {
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
                Venue
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Tipo
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Importe
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Asignado a
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
                      {order.assignee?.full_name ?? order.creator?.full_name ?? '—'}
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
