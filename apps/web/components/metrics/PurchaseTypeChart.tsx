'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
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
  otro: '#6b7280',
  sin_tipo: '#d1d5db',
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
