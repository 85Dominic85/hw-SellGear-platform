import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import StatusBadge from '@/components/orders/StatusBadge'
import StatusChangePanel from '@/components/orders/StatusChangePanel'
import CommentsList from '@/components/orders/CommentsList'
import ItemsList from '@/components/orders/ItemsList'
import SupplierSection from '@/components/orders/SupplierSection'
import SlackNotifyButton from '@/components/orders/SlackNotifyButton'
import DeleteOrderButton from '@/components/orders/DeleteOrderButton'
import AutoMarkSeen from '@/components/orders/AutoMarkSeen'
import EditableHeader from '@/components/orders/EditableHeader'
import OrderDetailFields from '@/components/orders/OrderDetailFields'
import MessageToHardwarePanel from '@/components/orders/MessageToHardwarePanel'
import { isAdminUser, canCreateShipment } from '@/lib/auth'
import SlaIndicator from '@/components/orders/SlaIndicator'
import ShippingTrackingPanel from '@/components/orders/ShippingTrackingPanel'
import { loadServicesCatalog } from '@/lib/tipsa/services'
import type { OrderStatus, ShippingEvent, UserRole } from '@/types/database'

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
  let isViewer = false
  let isCommercial = false
  let canEdit = false
  let canShipment = false
  if (currentUser) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email, role')
      .eq('id', currentUser.id)
      .single()
    isAdmin = isAdminUser(profile?.email ?? currentUser.email, profile?.role)
    isViewer = profile?.role === 'viewer'
    isCommercial = profile?.role === 'commercial'
    const role = profile?.role as UserRole | undefined
    canEdit = isAdmin || (!!role && ['admin', 'manager', 'hardware'].includes(role))
    canShipment = isAdmin || canCreateShipment(role)
  }
  // Roles externos: solo lectura del pedido + envío en modo consulta + caja
  // de mensaje para Hardware. Sin cambio de estado, sin Slack, sin proveedor.
  const isExternalRole = isViewer || isCommercial

  // Load order with all relations
  const { data: order } = await supabase
    .from('orders')
    .select(
      `
      *,
      creator:user_profiles!orders_created_by_fkey(id, full_name, email, role, department, created_at, updated_at),
      assignee:user_profiles!orders_assigned_to_fkey(id, full_name, email, role, department, created_at, updated_at),
      order_items(*, product:products(id, code, name, package_count, vat_rate)),
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

  // Cargar shipping_events aparte para no romper si la migracion TIPSA
  // aun no esta aplicada (tabla no existe → error controlado).
  let shippingEvents: ShippingEvent[] = []
  try {
    const { data: events } = await supabase
      .from('shipping_events')
      .select('*')
      .eq('order_id', id)
      .order('event_date', { ascending: false })
    shippingEvents = (events ?? []) as ShippingEvent[]
  } catch {
    // Tabla no existe aun — seguimos sin eventos.
  }

  const tipsaServices = loadServicesCatalog()

  const items = order.order_items ?? []
  // Bultos TIPSA pre-calculados: SUM(qty * product.package_count). Items legacy = 1.
  const defaultPackages = items.reduce(
    (sum: number, i: { qty: number; product?: { package_count?: number } | null }) =>
      sum + i.qty * (i.product?.package_count ?? 1),
    0,
  )
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
          <div className="flex items-start gap-3">
            <EditableHeader
              orderId={order.id}
              customerName={order.customer_name}
              venueName={order.venue_name}
              canEdit={canEdit}
            />
            <StatusBadge status={order.status as OrderStatus} />
            <SlaIndicator
              createdAt={order.created_at}
              deliveredAt={order.delivered_at}
              isTerminal={order.status === 'completado' || order.status === 'bloqueado'}
            />
          </div>
        </div>
      </div>

      {/* Two-column layout: main content + sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content — 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Details grid */}
          <OrderDetailFields order={order} canEdit={canEdit} isViewer={isViewer} />

          {/* Items */}
          <ItemsList orderId={order.id} items={items} readOnly={isViewer} />

          {/* Comments */}
          <CommentsList orderId={order.id} comments={comments} readOnly={isViewer} />

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
        {isExternalRole ? (
          /* Comercial / Viewer: solo tracking público (si hay envío) + mensaje a Hardware */
          <div className="space-y-4">
            {order.tracking_number && (
              <ShippingTrackingPanel
                orderId={order.id}
                trackingNumber={order.tracking_number ?? null}
                carrier={order.carrier ?? null}
                trackingLastStatus={order.tracking_last_status ?? null}
                trackingLastCheckedAt={order.tracking_last_checked_at ?? null}
                trackingPublicUrl={order.tracking_public_url ?? null}
                shippingLabelUrl={order.shipping_label_url ?? null}
                shippedAt={order.shipped_at ?? null}
                events={shippingEvents}
                services={tipsaServices}
                defaultContent=""
                canCreate={false}
                canRefresh={false}
                canDelete={false}
              />
            )}
            <MessageToHardwarePanel orderId={order.id} />
          </div>
        ) : (
          /* Hardware / Manager / Admin: vista interna completa */
          <div className="space-y-4">
            <StatusChangePanel orderId={order.id} currentStatus={order.status as OrderStatus} />
            <ShippingTrackingPanel
              orderId={order.id}
              trackingNumber={order.tracking_number ?? null}
              carrier={order.carrier ?? null}
              trackingLastStatus={order.tracking_last_status ?? null}
              trackingLastCheckedAt={order.tracking_last_checked_at ?? null}
              trackingPublicUrl={order.tracking_public_url ?? null}
              shippingLabelUrl={order.shipping_label_url ?? null}
              shippedAt={order.shipped_at ?? null}
              events={shippingEvents}
              services={tipsaServices}
              defaultContent={
                items.length > 0
                  ? items.map((i: { product_name: string | null; qty: number }) =>
                      `${i.qty}× ${i.product_name ?? 'Producto'}`,
                    ).join(', ').slice(0, 100)
                  : 'Productos hardware'
              }
              defaultPackages={defaultPackages > 0 ? defaultPackages : undefined}
              canCreate={canShipment}
              canRefresh={canEdit}
              canDelete={isAdmin}
            />
            <SupplierSection
              orderId={order.id}
              currentSupplier={order.supplier}
              operationId={order.operation_id}
              customerName={order.customer_name}
              venueName={order.venue_name}
              phone={order.phone}
              contactEmail={order.contact_email}
              shippingAddress={order.shipping_address}
              notes={order.notes}
              items={items.map((i: { product_name: string | null; qty: number }) => ({
                product_name: i.product_name ?? '(sin nombre)',
                qty: i.qty,
              }))}
            />
            <SlackNotifyButton orderId={order.id} />
            {isAdmin && (
              <DeleteOrderButton orderId={order.id} operationId={order.operation_id} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
