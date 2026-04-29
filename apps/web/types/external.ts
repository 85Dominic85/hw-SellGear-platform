// =============================================================
// Tipos públicos del endpoint /api/external/metrics
// Consumido por HW Main Portal (dashboard agregador read-only).
// =============================================================

import type { OrderStatus, PurchaseType } from './database'

export interface ExternalMetricsKpis {
  total_orders: number
  total_revenue: number
  avg_order_value: number
  /** Ratio 0-1 de pedidos en estado completado. */
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
}
