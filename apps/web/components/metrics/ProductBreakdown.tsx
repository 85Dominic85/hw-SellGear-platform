'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import ChartCard from './ChartCard'

interface ProductBreakdownProps {
  data: { product_name: string; total_qty: number; order_count: number }[]
}

export default function ProductBreakdown({ data }: ProductBreakdownProps) {
  const top10 = data.slice(0, 10).map((d) => ({
    ...d,
    name: d.product_name.length > 25 ? d.product_name.slice(0, 22) + '...' : d.product_name,
  }))

  return (
    <ChartCard title="Hardware vendido">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top10} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [value ?? 0, 'Unidades']}
              labelFormatter={(label) => {
                const item = top10.find((d) => d.name === String(label))
                return item ? item.product_name : String(label)
              }}
            />
            <Bar dataKey="total_qty" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
