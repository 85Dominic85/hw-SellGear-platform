import type { PeriodPreset } from '@/types/metrics'

export function getDateRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let from: Date
  let to: Date = new Date(today.getTime() + 86400000 - 1) // end of today

  switch (preset) {
    case 'this_week': {
      const day = today.getDay()
      const diff = day === 0 ? 6 : day - 1 // Monday = 0
      from = new Date(today)
      from.setDate(today.getDate() - diff)
      break
    }
    case 'this_month':
      from = new Date(today.getFullYear(), today.getMonth(), 1)
      break
    case 'this_quarter': {
      const q = Math.floor(today.getMonth() / 3)
      from = new Date(today.getFullYear(), q * 3, 1)
      break
    }
    case 'last_month':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      to = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59)
      break
    case 'last_quarter': {
      const cq = Math.floor(today.getMonth() / 3)
      const pq = cq === 0 ? 3 : cq - 1
      const yr = cq === 0 ? today.getFullYear() - 1 : today.getFullYear()
      from = new Date(yr, pq * 3, 1)
      to = new Date(yr, pq * 3 + 3, 0, 23, 59, 59)
      break
    }
    default:
      from = new Date(today.getFullYear(), today.getMonth(), 1)
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

export function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}

export function groupByWeek(
  dailyData: { date: string; count: number; revenue: number }[]
): { date: string; count: number; revenue: number }[] {
  const weeks: Record<string, { count: number; revenue: number; start: string }> = {}

  for (const d of dailyData) {
    const dt = new Date(d.date)
    const day = dt.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(dt)
    monday.setDate(dt.getDate() - diff)
    const key = monday.toISOString().slice(0, 10)

    if (!weeks[key]) {
      weeks[key] = { count: 0, revenue: 0, start: key }
    }
    weeks[key].count += d.count
    weeks[key].revenue += d.revenue
  }

  return Object.values(weeks)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((w) => ({ date: w.start, count: w.count, revenue: w.revenue }))
}

export interface CsvSummary {
  from: string
  to: string
  purchase_type: string
  total_orders: number
  total_revenue: number
  avg_order_value: number
  completed_rate: number
  ops_total_shipped?: number
  ops_total_completed?: number
  ops_avg_handling_days?: number
  ops_avg_transit_days?: number
  ops_on_time_shipping_pct?: number
  ops_blocked_count?: number
  ops_excluded_admin?: number
  sla_total_delivered?: number
  sla_avg_delivery_days?: number
  sla_on_time_pct?: number
  sla_breached_count?: number
  sla_active_at_risk?: number
}

export interface CsvOrderRow {
  operation_id: string
  created_at: string
  customer_name: string
  venue_name: string | null
  purchase_type: string | null
  amount: number | null
  status: string
  supplier: string | null
  products: string
  invoiced?: boolean | null
  requester_name?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
}

export function generateCSV(
  orders: CsvOrderRow[],
  options?: { includeExtended?: boolean; summary?: CsvSummary }
): string {
  const extended = options?.includeExtended ?? false
  const summary = options?.summary
  const lines: string[] = []

  if (summary) {
    lines.push('# Resumen del periodo')
    lines.push(`Periodo,${summary.from.slice(0, 10)},${summary.to.slice(0, 10)}`)
    lines.push(`Tipo compra,${summary.purchase_type}`)
    lines.push(`Pedidos totales,${summary.total_orders}`)
    lines.push(`Ingresos totales,${summary.total_revenue}`)
    lines.push(`Ticket medio,${summary.avg_order_value}`)
    lines.push(`Tasa entrega exitosa (%),${summary.completed_rate}`)
    if (summary.ops_total_shipped !== undefined)
      lines.push(`Pedidos enviados,${summary.ops_total_shipped}`)
    if (summary.ops_total_completed !== undefined)
      lines.push(`Pedidos completados,${summary.ops_total_completed}`)
    if (summary.ops_avg_handling_days !== undefined)
      lines.push(`Plazo medio manipulacion (dias),${summary.ops_avg_handling_days}`)
    if (summary.ops_avg_transit_days !== undefined)
      lines.push(`Plazo medio transporte (dias),${summary.ops_avg_transit_days}`)
    if (summary.ops_on_time_shipping_pct !== undefined)
      lines.push(`Cumplimiento envio 5d (%),${summary.ops_on_time_shipping_pct}`)
    if (summary.sla_avg_delivery_days !== undefined)
      lines.push(`Plazo medio entrega total (dias),${summary.sla_avg_delivery_days}`)
    if (summary.sla_on_time_pct !== undefined)
      lines.push(`Cumplimiento SLA 7d (%),${summary.sla_on_time_pct}`)
    if (summary.sla_active_at_risk !== undefined)
      lines.push(`Pedidos en riesgo (activos),${summary.sla_active_at_risk}`)
    if (summary.sla_breached_count !== undefined)
      lines.push(`Fuera de plazo (periodo),${summary.sla_breached_count}`)
    if (summary.ops_blocked_count !== undefined)
      lines.push(`Pedidos bloqueados,${summary.ops_blocked_count}`)
    if (summary.ops_excluded_admin !== undefined)
      lines.push(`Excluidos del SLA fisico (SaaS/otro),${summary.ops_excluded_admin}`)
    lines.push('')
    lines.push('# Detalle de pedidos')
  }

  let header = 'ID Operacion,Fecha,Cliente,Venue,Tipo Compra,Importe,Estado'
  if (extended) header += ',Facturado,Solicitante'
  header += ',Proveedor,Productos,Shipped At,Delivered At,Plazo Manipulacion (d),Plazo Total (d)'
  lines.push(header)

  for (const o of orders) {
    const created = o.created_at ? new Date(o.created_at) : null
    const shipped = o.shipped_at ? new Date(o.shipped_at) : null
    const delivered = o.delivered_at ? new Date(o.delivered_at) : null
    const handlingDays =
      created && shipped ? ((shipped.getTime() - created.getTime()) / 86400000).toFixed(1) : ''
    const totalDays =
      created && delivered ? ((delivered.getTime() - created.getTime()) / 86400000).toFixed(1) : ''

    const fields = [
      o.operation_id,
      created ? created.toLocaleDateString('es-ES') : '',
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      `"${(o.venue_name || '').replace(/"/g, '""')}"`,
      o.purchase_type || '',
      o.amount != null ? o.amount.toString() : '',
      o.status || '',
    ]
    if (extended) {
      fields.push(o.invoiced ? 'Si' : 'No')
      fields.push(`"${(o.requester_name || '').replace(/"/g, '""')}"`)
    }
    fields.push(o.supplier || '')
    fields.push(`"${(o.products || '').replace(/"/g, '""')}"`)
    fields.push(shipped ? shipped.toISOString() : '')
    fields.push(delivered ? delivered.toISOString() : '')
    fields.push(handlingDays)
    fields.push(totalDays)
    lines.push(fields.join(','))
  }

  return lines.join('\n')
}
