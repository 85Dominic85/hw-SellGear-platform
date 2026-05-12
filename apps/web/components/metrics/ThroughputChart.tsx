'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import ChartCard from './ChartCard'

interface ThroughputChartProps {
  data: { week_start: string; created: number; shipped: number; delivered: number }[]
}

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

const SERIES_LABELS: Record<string, string> = {
  created: 'Creados',
  shipped: 'Enviados',
  delivered: 'Entregados',
}

export default function ThroughputChart({ data }: ThroughputChartProps) {
  if (!data || data.length === 0) {
    return (
      <ChartCard title="Throughput semanal del departamento">
        <div className="flex h-64 items-center justify-center text-sm text-gray-400 italic">
          Sin datos en este periodo
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Throughput semanal del departamento">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week_start" tickFormatter={formatWeekLabel} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(value, name) => {
                const v = typeof value === 'number' ? value : Number(value) || 0
                const key = String(name ?? '')
                return [v, SERIES_LABELS[key] ?? key]
              }}
              labelFormatter={(label) => `Semana del ${formatWeekLabel(String(label))}`}
            />
            <Legend
              formatter={(value: string) => SERIES_LABELS[value] ?? value}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="created"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="created"
            />
            <Line
              type="monotone"
              dataKey="shipped"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              name="shipped"
            />
            <Line
              type="monotone"
              dataKey="delivered"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="delivered"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-gray-400 text-center">
        La linea azul (enviados) refleja el ritmo de envios fisicos despachados desde la oficina cada semana.
      </p>
    </ChartCard>
  )
}
