import type { PurchaseType } from './database'

export interface DashboardMetrics {
  total_orders: number
  total_revenue: number
  avg_order_value: number
  /** Porcentaje 0-100 de pedidos completados sobre activos (excluye 'bloqueado'). */
  completed_rate: number
  orders_by_date: { date: string; count: number; revenue: number }[]
  by_purchase_type: { purchase_type: string; count: number; revenue: number }[]
  by_status: { status: string; count: number }[]
  by_product: { product_name: string; total_qty: number; order_count: number }[]

  // KPIs operativos del departamento (opcionales: pueden faltar en RPC antigua)
  ops_total_shipped?: number
  ops_total_completed?: number
  ops_avg_handling_days?: number
  ops_avg_transit_days?: number
  ops_on_time_shipping_pct?: number
  ops_throughput_by_week?: {
    week_start: string
    created: number
    shipped: number
    delivered: number
  }[]
  ops_blocked_count?: number
  ops_excluded_admin?: number
}

export interface DashboardComparison {
  prev_total_orders: number
  prev_total_revenue: number
  prev_avg_order_value: number
  prev_completed_rate: number

  prev_ops_total_shipped?: number
  prev_ops_total_completed?: number
  prev_ops_avg_handling_days?: number
  prev_ops_on_time_shipping_pct?: number
}

export interface SlaMetrics {
  total_delivered: number
  avg_delivery_days: number
  on_time_pct: number
  breached_count: number
  active_at_risk: number
  sla_by_week: {
    week_start: string
    avg_days: number
    on_time_pct: number
    count: number
  }[]
}

/**
 * Fila del ranking de solicitantes (RPC get_requesters_ranking).
 * Una fila por solicitante (agrupado por email normalizado).
 * `requester_name` puede ser null si todos los pedidos del email no
 * tenían nombre rellenado (caso raro pero posible).
 */
export interface RequesterRankingRow {
  requester_email: string
  requester_name: string | null
  total_equipment_qty: number
  total_orders: number
  total_revenue: number
}

export type PeriodPreset = 'this_week' | 'this_month' | 'this_quarter' | 'last_month' | 'last_quarter' | 'custom'

export interface MetricsFilters {
  from: string
  to: string
  preset: PeriodPreset
  purchase_type?: PurchaseType | 'all'
}
