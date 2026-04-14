'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts'
import ChartCard from './ChartCard'
import { SLA_TARGET_DAYS } from '@/lib/sla'

interface SlaChartProps {
  data: {
    week_start: string
    avg_days: number
    on_time_pct: number
    count: number
  }[]
}

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export default function SlaChart({ data }: SlaChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard title="Tendencia SLA semanal">
        <div className="flex h-64 items-center justify-center text-sm text-gray-400 italic">
          Sin datos de entregas en este periodo
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Tendencia SLA semanal">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="week_start"
              tickFormatter={formatWeekLabel}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              domain={[0, (dataMax: number) => Math.max(dataMax + 2, SLA_TARGET_DAYS + 3)]}
              tickFormatter={(v: number) => `${v}d`}
            />
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => {
                const v = value ?? 0
                if (name === 'avg_days') return [`${v}d`, 'Media dias']
                return [v, name ?? '']
              }}
              labelFormatter={(label) => `Semana del ${formatWeekLabel(String(label))}`}
            />

            {/* Linea de referencia SLA = 7 dias */}
            <ReferenceLine
              y={SLA_TARGET_DAYS}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{
                value: `SLA ${SLA_TARGET_DAYS}d`,
                position: 'right',
                fill: '#ef4444',
                fontSize: 11,
                fontWeight: 600,
              }}
            />

            {/* Area bajo la linea para enfasis visual */}
            <Area
              type="monotone"
              dataKey="avg_days"
              fill="#3b82f6"
              fillOpacity={0.1}
              stroke="none"
            />

            {/* Linea principal: media de dias */}
            <Line
              type="monotone"
              dataKey="avg_days"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              name="avg_days"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex items-center justify-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded bg-blue-500" />
          <span>Media dias entrega</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded border-t-2 border-dashed border-red-500" />
          <span>Limite SLA ({SLA_TARGET_DAYS}d)</span>
        </div>
      </div>
    </ChartCard>
  )
}
