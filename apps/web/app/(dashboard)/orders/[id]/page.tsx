import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, PURCHASE_TYPE_LABELS } from '@/lib/utils'
import StatusBadge from '@/components/orders/StatusBadge'
import StatusChangePanel from '@/components/orders/StatusChangePanel'
import CommentsList from '@/components/orders/CommentsList'
import ItemsList from '@/components/orders/ItemsList'
import SupplierSelect from '@/components/orders/SupplierSelect'
import SlackNotifyButton from '@/components/orders/SlackNotifyButton'
import InvoiceCheckbox from '@/components/orders/InvoiceCheckbox'
import DeleteOrderButton from '@/components/orders/DeleteOrderButton'
import AutoMarkSeen from '@/components/orders/AutoMarkSeen'
import { isAdminUser } from '@/lib/auth'
import type { OrderStatus, PurchaseType } from '@/types/database'

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Check if current user is admin
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  let isAdmin = false
  if (currentUser) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email, role')
      .eq('id', currentUser.id)
      .single()
    isAdmin = isAdminUser(profile?.email ?? currentUser.email, profile?.role)
  }

  // Load order with all relations
  const { data: order } = await supabase
    .from('orders')
    .select(
      `
      *,
      creator:user_profiles!orders_created_by_fkey(id, full_name, email, role, department, created_at, updated_at),
      assignee:user_profiles!orders_assigned_to_fkey(id, full_name, email, role, department, created_at, updated_at),
      order_items(*),
      status_history:status_history(
        id, order_id, from_status, to_status, changed_by, changed_at, comment,
        changer:user_profiles!status_history_changed_by_fkey(id, full_name, email, role, department, created_at, updated_at)
      ),
      comments(
        id, order_id, author_id, body, created_at, updated_at,
        author:user_profiles!comments_author_id_fkey(id, full_name, email, role, department, created_at, updated_at)
      )
    `
    )
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  const items = order.order_items ?? []
  const statusHistory = (order.status_history ?? []).sort(
    (a: { changed_at: string }, b: { changed_at: string }) =>
      new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  )
  const comments = (order.comments ?? []).sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <div className="px-6 py-8">
      {/* Auto-transicion nuevo → pendiente al visualizar */}
      <AutoMarkSeen orderId={order.id} currentStatus={order.status} />

      {/* Breadcrumb + header */}
      <div className="mb-6">
        <nav className="mb-2 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/orders" className="hover:text-gray-700">
            Pedidos
          </Link>
          <span>/</span>
          <span className="font-mono text-gray-900">{order.operation_id}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{order.customer_name}</h1>
              <StatusBadge status={order.status as OrderStatus} />
            </div>
            {order.venue_name && (
              <p className="mt-1 text-sm text-gray-500">{order.venue_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout: main content + sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content — 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Details grid */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Detalles del pedido</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500">ID de operación</dt>
                <dd className="mt-0.5 font-mono text-sm font-medium text-gray-900">
                  {order.operation_id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Tipo de compra</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {order.purchase_type ? PURCHASE_TYPE_LABELS[order.purchase_type as PurchaseType] : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Importe</dt>
                <dd className="mt-0.5 text-sm font-medium text-gray-900">
                  {formatCurrency(order.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Factura</dt>
                <dd className="mt-1">
                  <InvoiceCheckbox orderId={order.id} currentValue={order.invoiced} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Email de contacto</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {order.contact_email ? (
                    <a
                      href={`mailto:${order.contact_email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {order.contact_email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Teléfono</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{order.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Origen</dt>
                <dd className="mt-0.5 text-sm text-gray-900 capitalize">{order.source}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Departamento</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {order.source_department ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Fecha de creación</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {formatDate(order.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Última actualización</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {formatDate(order.updated_at)}
                </dd>
              </div>
              {order.ae_ref && (
                <div>
                  <dt className="text-xs text-gray-500">Ref AE</dt>
                  <dd className="mt-0.5 font-mono text-sm text-gray-900">{order.ae_ref}</dd>
                </div>
              )}
              {order.hubspot_ref && (
                <div>
                  <dt className="text-xs text-gray-500">Ref HubSpot</dt>
                  <dd className="mt-0.5 font-mono text-sm text-gray-900">
                    {order.hubspot_ref}
                  </dd>
                </div>
              )}
              {order.invoice_ref && (
                <div>
                  <dt className="text-xs text-gray-500">Ref factura</dt>
                  <dd className="mt-0.5 font-mono text-sm text-gray-900">
                    {order.invoice_ref}
                  </dd>
                </div>
              )}
              {order.shipping_address && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs text-gray-500">Dirección de envío</dt>
                  <dd className="mt-0.5 text-sm text-gray-900">{order.shipping_address}</dd>
                </div>
              )}
              {order.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs text-gray-500">Notas</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900">
                    {order.notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Items */}
          <ItemsList orderId={order.id} items={items} />

          {/* Comments */}
          <CommentsList orderId={order.id} comments={comments} />

          {/* Status history */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Historial de estados
            </h3>
            {statusHistory.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin historial.</p>
            ) : (
              <ol className="space-y-3">
                {statusHistory.map(
                  (entry: {
                    id: string
                    from_status: OrderStatus | null
                    to_status: OrderStatus
                    changed_at: string
                    comment: string | null
                    changer?: { full_name?: string; email?: string }
                  }) => (
                    <li key={entry.id} className="flex items-start gap-3">
                      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gray-400" />
                      <div>
                        <p className="text-sm text-gray-700">
                          {entry.from_status ? (
                            <>
                              <span className="font-medium">{entry.from_status}</span>
                              {' → '}
                            </>
                          ) : null}
                          <span className="font-medium text-gray-900">
                            {entry.to_status}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(entry.changed_at)}
                          {entry.changer?.full_name
                            ? ` · ${entry.changer.full_name}`
                            : ''}
                        </p>
                        {entry.comment && (
                          <p className="mt-0.5 text-xs text-gray-500 italic">
                            {entry.comment}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                )}
              </ol>
            )}
          </div>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">
          <StatusChangePanel orderId={order.id} currentStatus={order.status as OrderStatus} />
          <SupplierSelect orderId={order.id} currentSupplier={order.supplier} />
          <SlackNotifyButton orderId={order.id} />
          {isAdmin && (
            <DeleteOrderButton orderId={order.id} operationId={order.operation_id} />
          )}
        </div>
      </div>
    </div>
  )
}
