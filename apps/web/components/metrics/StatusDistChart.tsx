'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { STATUS_LABELS } from '@/lib/utils'
import type { OrderStatus } from '@/types/database'
import ChartCard from './ChartCard'

interface StatusDistChartProps {
  data: { status: string; count: number }[]
}

const STATUS_CHART_COLORS: Record<string, string> = {
  nuevo: '#3b82f6',
  pendiente: '#eab308',
  solicitado_a_proveedor: '#8b5cf6',
  pagado: '#22c55e',
  falta_informacion: '#f97316',
  bloqueado: '#ef4444',
}

export default function StatusDistChart({ data }: StatusDistChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    name: STATUS_LABELS[d.status as OrderStatus] || d.status,
  }))

  return (
    <ChartCard title="Estado pedidos">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={STATUS_CHART_COLORS[entry.status] || '#6b7280'} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [value ?? 0, 'Pedidos']} />
            <Legend
              formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
