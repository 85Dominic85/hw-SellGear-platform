import type { PurchaseType } from './database'

export interface DashboardMetrics {
  total_orders: number
  total_revenue: number
  avg_order_value: number
  completed_rate: number
  orders_by_date: { date: string; count: number; revenue: number }[]
  by_purchase_type: { purchase_type: string; count: number; revenue: number }[]
  by_status: { status: string; count: number }[]
  by_product: { product_name: string; total_qty: number; order_count: number }[]
}

export interface DashboardComparison {
  prev_total_orders: number
  prev_total_revenue: number
  prev_avg_order_value: number
  prev_completed_rate: number
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

export type PeriodPreset = 'this_week' | 'this_month' | 'this_quarter' | 'last_month' | 'last_quarter' | 'custom'

export interface MetricsFilters {
  from: string
  to: string
  preset: PeriodPreset
  purchase_type?: PurchaseType | 'all'
}
