'use client'

import { useState } from 'react'
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts'
import { cn } from '@/lib/utils'
import { groupByWeek } from '@/lib/metrics'
import ChartCard from './ChartCard'

interface OrdersTimeChartProps {
  data: { date: string; count: number; revenue: number }[]
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export default function OrdersTimeChart({ data }: OrdersTimeChartProps) {
  const [mode, setMode] = useState<'daily' | 'weekly'>('weekly')
  const chartData = mode === 'weekly' ? groupByWeek(data) : data

  return (
    <ChartCard title="Pedidos en el tiempo">
      <div className="mb-3 flex gap-1">
        {(['weekly', 'daily'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              mode === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
            )}
          >
            {m === 'weekly' ? 'Semanal' : 'Diario'}
          </button>
        ))}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => {
                const v = value ?? 0
                if (name === 'revenue') return [`${v.toLocaleString('es-ES')} €`, 'Ingresos']
                return [v, 'Pedidos']
              }}
              labelFormatter={(label) => formatDateLabel(String(label))}
            />
            <Bar yAxisId="left" dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="count" />
            <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={false} name="revenue" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
