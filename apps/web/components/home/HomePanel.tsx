import Link from 'next/link'
import { Package, Truck, BarChart3 } from 'lucide-react'
import KpiTile from './KpiTile'
import CategoryTile from './CategoryTile'
import { canCreateOrder } from '@/lib/auth'
import type { PurchaseType, UserRole } from '@/types/database'

export interface CategoryStats {
  type: PurchaseType
  total: number
  nuevo: number
}

interface HomePanelProps {
  role: UserRole | null | undefined
  ordersTotal: number
  ordersNuevo: number
  shipmentsTotal: number
  shipmentsActive: number
  monthOrdersTotal: number
  metricsHeadline: string | null
  categories: CategoryStats[]
}

function showMetricsTile(role: UserRole | null | undefined): boolean {
  return !!role && (['admin', 'manager', 'hardware'] as UserRole[]).includes(role)
}

export default function HomePanel({
  role,
  ordersTotal,
  ordersNuevo,
  shipmentsTotal,
  shipmentsActive,
  monthOrdersTotal,
  metricsHeadline,
  categories,
}: HomePanelProps) {
  const showMetrics = showMetricsTile(role)
  const showNewOrderBtn = canCreateOrder(role)

  // Pedidos: si hay nuevos, accionable. Si no, mostramos el total como info.
  const ordersActionable =
    ordersNuevo > 0
      ? `${ordersNuevo} ${ordersNuevo === 1 ? 'nuevo por revisar' : 'nuevos por revisar'}`
      : 'Sin pedidos nuevos'
  const ordersTotalLine = `de ${ordersTotal} totales`

  // Envios: actionable = en transito (no entregados aun), total = total
  const shipmentsActionable =
    shipmentsActive > 0
      ? `${shipmentsActive} en transito`
      : shipmentsTotal > 0
        ? 'Todos entregados'
        : 'Sin envios'
  const shipmentsTotalLine =
    shipmentsTotal > 0 ? `${shipmentsTotal} totales` : undefined

  // Metricas: headline accionable (Tasa entrega o pedidos del mes)
  const metricsActionable = metricsHeadline ?? `${monthOrdersTotal} este mes`
  const metricsTotalLine = metricsHeadline ? `${monthOrdersTotal} pedidos este mes` : undefined

  return (
    <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inicio</h1>
          <p className="mt-1 text-sm text-gray-500">Resumen operativo</p>
        </div>
        {showNewOrderBtn && (
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo pedido
          </Link>
        )}
      </header>

      {/* Fila 1: tarjetas grandes con jerarquia 2/1/1 */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiTile
          className="md:col-span-2"
          href="/orders"
          label="Pedidos"
          actionableValue={ordersActionable}
          totalValue={ordersTotalLine}
          size="lg"
          icon={<Package className="h-6 w-6" />}
        />
        <KpiTile
          href="/shipments"
          label="Envios"
          actionableValue={shipmentsActionable}
          totalValue={shipmentsTotalLine}
          size="md"
          icon={<Truck className="h-5 w-5" />}
        />
        {showMetrics && (
          <KpiTile
            href="/metrics"
            label="Metricas"
            actionableValue={metricsActionable}
            totalValue={metricsTotalLine}
            size="md"
            icon={<BarChart3 className="h-5 w-5" />}
          />
        )}
      </section>

      {/* Fila 2: tarjetas pequenas con las 3 categorias mas usadas */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Categorias mas usadas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {categories.map((c) => (
            <CategoryTile key={c.type} type={c.type} total={c.total} nuevo={c.nuevo} />
          ))}
        </div>
      </section>
    </div>
  )
}
