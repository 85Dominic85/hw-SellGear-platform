'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import { STATUS_LABELS } from '@/lib/utils'
import type { OrderStatus } from '@/types/database'
import ChartCard from './ChartCard'

interface StatusDistChartProps {
  data: { status: string; count: number }[]
}

const STATUS_CHART_COLORS: Record<string, string> = {
  nuevo: '#3b82f6',
  pendiente: '#eab308',
  enviado_proveedor: '#8b5cf6',
  enviado: '#6366f1',
  pagado: '#22c55e',
  falta_informacion: '#f97316',
  bloqueado: '#ef4444',
  completado: '#16a34a',
}

const RADIAN = Math.PI / 180

function renderLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0)
  const cy = Number(props.cy ?? 0)
  const midAngle = Number(props.midAngle ?? 0)
  const outerRadius = Number(props.outerRadius ?? 0)
  const value = Number(props.value ?? 0)
  const percent = Number(props.percent ?? 0)
  const radius = outerRadius + 18
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  if (percent < 0.03) return null
  return (
    <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {value} ({(percent * 100).toFixed(0)}%)
    </text>
  )
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
              label={renderLabel}
              labelLine={true}
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
