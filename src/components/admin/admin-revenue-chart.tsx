'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface RevenuePoint {
  monthLabel: string
  revenue: number
}

/**
 * Colours are the chart tokens from globals.css, which already redefine
 * themselves under `.dark`. That removes the `useTheme()`/`isDark` branch this
 * component used to carry: the CSS cascade does the light/dark swap, so the
 * chart no longer re-renders when the theme store changes and has no
 * server/client themed markup at all.
 */
export function AdminRevenueChart({ data, emptyLabel }: { data: RevenuePoint[]; emptyLabel: string }) {
  const hasData = data.some((point) => point.revenue > 0)

  if (!hasData) {
    return (
      <div className="h-[260px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">{emptyLabel}</div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAdminRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="monthLabel"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
          tickFormatter={(v) => {
            if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
            if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
            return v
          }}
        />
        <Tooltip
          formatter={(value: any) => formatCurrency(value as number)}
          cursor={{ stroke: 'var(--chart-1)', strokeWidth: 1, strokeDasharray: '4 4' }}
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
            boxShadow: '0 12px 28px -6px oklch(0.38 0.19 295 / 0.18)',
            fontSize: '12px',
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#colorAdminRevenue)"
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
