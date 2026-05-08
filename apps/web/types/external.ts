// =============================================================
// Tipos públicos del endpoint /api/external/metrics
// Consumido por HW Main Portal (dashboard agregador read-only).
// =============================================================

import type { OrderStatus, PurchaseType } from './database'

export interface ExternalMetricsKpis {
  total_orders: number
  total_revenue: number
  avg_order_value: number
  /** Porcentaje 0-100 de pedidos completados sobre activos (excluye 'bloqueado'). */
  completed_rate: number
}

export interface ExternalMetricsComparison {
  prev_total_orders: number
  prev_total_revenue: number
  prev_avg_order_value: number
  prev_completed_rate: number
}

export interface ExternalOrdersByDate {
  date: string
  count: number
  revenue: number
}

export interface ExternalBreakdownByPurchaseType {
  purchase_type: string
  count: number
  revenue: number
}

export interface ExternalBreakdownByStatus {
  status: string
  count: number
}

export interface ExternalBreakdownByProduct {
  product_name: string
  total_qty: number
  order_count: number
}

export interface ExternalSlaByWeek {
  week_start: string
  count: number
  avg_days: number
  on_time_pct: number
}

export interface ExternalSla {
  total_delivered: number
  avg_delivery_days: number
  on_time_pct: number
  breached_count: number
  active_at_risk: number
  sla_by_week: ExternalSlaByWeek[]
}

export interface ExternalRecentOrder {
  operation_id: string
  created_at: string
  customer_name: string
  venue_name: string | null
  purchase_type: PurchaseType | null
  amount: number | null
  status: OrderStatus
  tracking_number: string | null
}

export interface ExternalThroughputWeek {
  week_start: string
  created: number
  shipped: number
  delivered: number
}

export interface ExternalMetricsOps {
  total_shipped: number
  total_completed: number
  /** Días promedio created → shipped (envíos físicos). */
  avg_handling_days: number
  /** Días promedio shipped → delivered (transportista). */
  avg_transit_days: number
  /** Porcentaje 0-100 de envíos físicos despachados en ≤ 5 días. */
  on_time_shipping_pct: number
  throughput_by_week: ExternalThroughputWeek[]
  blocked_count: number
  /** Pedidos SaaS/otro completados, excluidos del SLA físico (transparencia). */
  excluded_admin: number
}

export interface ExternalMetricsResponse {
  generated_at: string
  range: { from: string; to: string }
  kpis: ExternalMetricsKpis
  comparison: ExternalMetricsComparison | null
  time_series: {
    orders_by_date: ExternalOrdersByDate[]
  }
  breakdowns: {
    by_purchase_type: ExternalBreakdownByPurchaseType[]
    by_status: ExternalBreakdownByStatus[]
    by_product: ExternalBreakdownByProduct[]
  }
  sla: ExternalSla
  recent_orders: ExternalRecentOrder[]
  /** KPIs operativos del departamento Hardware (opcional, opt-in). */
  ops?: ExternalMetricsOps
}

// =============================================================
// Tipos públicos del endpoint /api/external/hwtoolbox/orders
// Consumido por HWToolbox (gestión de inventario read-only).
// Solo expone pedidos en estados de envío:
//   preparado | enviado | enviado_proveedor | completado | bloqueado
// =============================================================

export interface HwToolboxOrderListItem {
  operation_id: string
  customer_name: string
  venue_name: string | null
  purchase_type: PurchaseType | null
  status: OrderStatus
  /** Importe total con IVA en EUR (puede ser null para pedidos legacy sin items). */
  amount: number | null
  created_at: string
}

export interface HwToolboxListPagination {
  total: number
  limit: number
  offset: number
}

export interface HwToolboxListResponse {
  generated_at: string
  pagination: HwToolboxListPagination
  orders: HwToolboxOrderListItem[]
}

export interface HwToolboxAe {
  full_name: string | null
  email: string | null
  /** Referencia AE manual (texto libre en el pedido). */
  ae_ref: string | null
}

export interface HwToolboxOrderItem {
  product_code: string | null
  product_name: string
  qty: number
  unit_price_cents: number
  vat_rate: number
  discount_pct: number
  /** Base imponible (subtotal sin IVA, descuento aplicado). */
  subtotal_cents: number
  vat_amount_cents: number
  /** Total con IVA. */
  total_cents: number
  currency: 'EUR'
}

export interface HwToolboxOrderTotals {
  /** Suma de qty * unit_price antes de descuentos. */
  subtotal_cents: number
  /** Suma de descuentos aplicados. */
  discount_cents: number
  /** Base imponible (subtotal - descuento). */
  taxable_cents: number
  vat_amount_cents: number
  /** Total con IVA. */
  total_cents: number
  currency: 'EUR'
}

export interface HwToolboxOrderDetail {
  operation_id: string
  customer_name: string
  venue_name: string | null
  purchase_type: PurchaseType | null
  /** Etiqueta humana en es-ES (ej. "Hardware One Off"). */
  purchase_type_label: string | null
  status: OrderStatus
  created_at: string
  /** Null si el pedido no tiene created_by (legacy Typeform). */
  ae: HwToolboxAe | null
  items: HwToolboxOrderItem[]
  totals: HwToolboxOrderTotals
}

export interface HwToolboxDetailResponse {
  generated_at: string
  order: HwToolboxOrderDetail
}
