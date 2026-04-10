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

export function generateCSV(
  orders: {
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
    ae_ref?: string | null
  }[],
  options?: { includeExtended?: boolean }
): string {
  const extended = options?.includeExtended ?? false
  let header = 'ID Operacion,Fecha,Cliente,Venue,Tipo Compra,Importe,Estado'
  if (extended) header += ',Facturado,Ref AE'
  header += ',Proveedor,Productos'

  const rows = orders.map((o) => {
    const fields = [
      o.operation_id,
      o.created_at ? new Date(o.created_at).toLocaleDateString('es-ES') : '',
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      `"${(o.venue_name || '').replace(/"/g, '""')}"`,
      o.purchase_type || '',
      o.amount != null ? o.amount.toString() : '',
      o.status || '',
    ]
    if (extended) {
      fields.push(o.invoiced ? 'Si' : 'No')
      fields.push(o.ae_ref || '')
    }
    fields.push(o.supplier || '')
    fields.push(`"${(o.products || '').replace(/"/g, '""')}"`)
    return fields.join(',')
  })

  return [header, ...rows].join('\n')
}
