import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import Link from 'next/link'
import type { OrderStatus, PurchaseType, UserRole } from '@/types/database'
import OrdersTable from '@/components/orders/OrdersTable'
import StatusFilter from '@/components/orders/StatusFilter'
import ShippingOriginFilter from '@/components/orders/ShippingOriginFilter'
import SearchBar from '@/components/orders/SearchBar'
import ExportCSVButton from '@/components/shared/ExportCSVButton'

interface SearchParams {
  status?: string
  search?: string
  type?: string
  shipping?: string
  page?: string
}

const PER_PAGE = 50

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Get current user role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userRole: UserRole | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    userRole = (profile?.role as UserRole) ?? null
  }

  // Paginacion server-side: ?page=N (default 1). 50 filas por pagina.
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const offset = (page - 1) * PER_PAGE

  let query = supabase
    .from('orders')
    .select('*, order_items(*), order_payments(installment_no, status)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status as OrderStatus)
  }

  if (params.type) {
    query = query.eq('purchase_type', params.type as PurchaseType)
  }

  if (params.shipping) {
    query = query.eq('status', params.shipping as OrderStatus)
  }

  if (params.search) {
    const term = `%${params.search}%`
    query = query.or(
      `customer_name.ilike.${term},operation_id.ilike.${term},venue_name.ilike.${term}`
    )
  }

  const { data: orders, error, count } = await query.range(offset, offset + PER_PAGE - 1)
  const total = count ?? 0

  return (
    <div className="px-6 py-8">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} pedido{total !== 1 ? 's' : ''}
            {params.status || params.search ? ' encontrados' : ' en total'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {userRole && ['admin', 'manager', 'hardware'].includes(userRole) && (
            <ExportCSVButton
              exportUrl="/api/orders/export"
              params={{
                status: params.status,
                search: params.search,
                type: params.type,
              }}
              label="Exportar CSV"
            />
          )}
          {userRole !== 'viewer' && (
            <Link
              href="/orders/new"
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Nuevo pedido
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Suspense>
          <StatusFilter />
        </Suspense>
        <div className="h-6 w-px bg-gray-200" />
        <Suspense>
          <ShippingOriginFilter />
        </Suspense>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          Error al cargar pedidos: {error.message}
        </div>
      )}

      {/* Table */}
      <OrdersTable
        orders={orders ?? []}
        userRole={userRole}
        page={page}
        perPage={PER_PAGE}
        total={total}
      />
    </div>
  )
}
