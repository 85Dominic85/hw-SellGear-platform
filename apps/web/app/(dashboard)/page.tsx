import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomePanel, { type CategoryStats } from '@/components/home/HomePanel'
import type { OrderStatus, PurchaseType, UserRole } from '@/types/database'
import type { SlaMetrics } from '@/types/metrics'

// Estados terminales TIPSA: no se cuentan como "activos en transito".
// 3 ENTREGADO y 5 DEVUELTO (catalogo oficial, ver TIPSA_TERMINAL_CODES).
// Antes decia {2,6}, con el mapa viejo: contaba como activo lo ya entregado y
// daba por cerrado lo que solo iba en reparto.
const ACTIVE_SHIPMENT_BLOCK = new Set<string>(['3', '5'])

// Las 3 categorias mas usadas que se muestran como CategoryTiles.
// Las otras (hardware_financiacion, otro) siguen accesibles desde sidebar.
const HOME_CATEGORIES: PurchaseType[] = [
  'kit_digital',
  'hardware_one_off',
  'transferencias_saas',
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profile?.role as UserRole | undefined

  // Inicio del mes en curso (UTC) para el KPI "Metricas".
  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const startOfMonthIso = startOfMonth.toISOString()

  // 4 fetches en paralelo. La query #1 trae solo 2 columnas y se reusa
  // para ordersTotal + ordersNuevo + categorias (1 solo viaje).
  const ordersAggPromise = supabase
    .from('orders')
    .select('status, purchase_type')

  const shipmentsAggPromise = supabase
    .from('shipments')
    .select('tracking_last_status, delivered_at')

  const monthOrdersCountPromise = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfMonthIso)

  // SLA metrics solo si el rol puede ver Metricas (admin/manager/hardware).
  // Es la misma RPC que /metrics; aqui pedimos el mes en curso.
  const showMetrics = !!role && (['admin', 'manager', 'hardware'] as UserRole[]).includes(role)
  const slaPromise = showMetrics
    ? supabase.rpc('get_sla_metrics', {
        p_from: startOfMonthIso,
        p_to: now.toISOString(),
      })
    : Promise.resolve({ data: null, error: null })

  const [ordersAgg, shipmentsAgg, monthOrdersCount, slaRes] = await Promise.all([
    ordersAggPromise,
    shipmentsAggPromise,
    monthOrdersCountPromise,
    slaPromise,
  ])

  // Agregar counts en JS
  let ordersTotal = 0
  let ordersNuevo = 0
  const categoryTotals = new Map<PurchaseType, { total: number; nuevo: number }>()

  for (const cat of HOME_CATEGORIES) {
    categoryTotals.set(cat, { total: 0, nuevo: 0 })
  }

  for (const row of ordersAgg.data ?? []) {
    ordersTotal++
    const isNuevo = (row.status as OrderStatus | null) === 'nuevo'
    if (isNuevo) ordersNuevo++

    const pt = row.purchase_type as PurchaseType | null
    if (pt && categoryTotals.has(pt)) {
      const stats = categoryTotals.get(pt)!
      stats.total++
      if (isNuevo) stats.nuevo++
    }
  }

  let shipmentsTotal = 0
  let shipmentsActive = 0
  for (const row of shipmentsAgg.data ?? []) {
    shipmentsTotal++
    const status = row.tracking_last_status as string | null
    const delivered = row.delivered_at as string | null
    // Activo: tiene tracking pero no es estado terminal y no esta entregado
    if (status && !ACTIVE_SHIPMENT_BLOCK.has(status) && !delivered) {
      shipmentsActive++
    }
  }

  // Headline para KpiTile Metricas: tasa entrega o cumplimiento SLA del mes
  const sla = (slaRes.data ?? null) as SlaMetrics | null
  const metricsHeadline =
    sla && sla.total_delivered > 0
      ? `Cumplimiento SLA ${sla.on_time_pct}%`
      : null

  const categories: CategoryStats[] = HOME_CATEGORIES.map((type) => ({
    type,
    total: categoryTotals.get(type)?.total ?? 0,
    nuevo: categoryTotals.get(type)?.nuevo ?? 0,
  }))

  return (
    <HomePanel
      role={role}
      ordersTotal={ordersTotal}
      ordersNuevo={ordersNuevo}
      shipmentsTotal={shipmentsTotal}
      shipmentsActive={shipmentsActive}
      monthOrdersTotal={monthOrdersCount.count ?? 0}
      metricsHeadline={metricsHeadline}
      categories={categories}
    />
  )
}
