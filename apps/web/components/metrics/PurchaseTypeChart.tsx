'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import { PURCHASE_TYPE_LABELS } from '@/lib/utils'
import ChartCard from './ChartCard'

interface PurchaseTypeChartProps {
  data: { purchase_type: string; count: number; revenue: number }[]
}

const TYPE_COLORS: Record<string, string> = {
  kit_digital: '#3b82f6',
  hardware_one_off: '#8b5cf6',
  hardware_financiacion: '#06b6d4',
  transferencias_saas: '#f59e0b',
  saas_hardware: '#ec4899',
  otro: '#6b7280',
  sin_tipo: '#d1d5db',
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

export default function PurchaseTypeChart({ data }: PurchaseTypeChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    name: PURCHASE_TYPE_LABELS[d.purchase_type as keyof typeof PURCHASE_TYPE_LABELS] || d.purchase_type,
  }))

  return (
    <ChartCard title="Tipo de venta">
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
                <Cell key={entry.purchase_type} fill={TYPE_COLORS[entry.purchase_type] || '#6b7280'} />
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
