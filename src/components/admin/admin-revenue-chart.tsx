'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface RevenuePoint {
  monthLabel: string
  revenue: number
}

export function AdminRevenueChart({ data, emptyLabel }: { data: RevenuePoint[]; emptyLabel: string }) {
  const hasData = data.some((point) => point.revenue > 0)

  if (!hasData) {
    return (
      <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">{emptyLabel}</div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAdminRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="monthLabel"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: '#64748b' }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickFormatter={(v) => {
            if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
            if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
            return v
          }}
        />
        <Tooltip
          formatter={(value: any) => formatCurrency(value as number)}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#6366f1"
          strokeWidth={3}
          fill="url(#colorAdminRevenue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
