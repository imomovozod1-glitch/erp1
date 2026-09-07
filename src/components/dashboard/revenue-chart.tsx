'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface RevenueChartProps {
  data: { month: string; income: number; expense: number }[]
  title: string
}

export function RevenueChart({ data, title }: RevenueChartProps) {
  const t = useTranslations()
  const formattedData = data.map((d) => {
    let label = d.month
    if (d.month.length === 7 && d.month.includes('-')) {
      const monthPart = d.month.slice(5, 7)
      label = t(`common.months.${monthPart}`)
    } else if (d.month.length === 10 && d.month.includes('-')) {
      const dayPart = d.month.slice(8, 10)
      const monthPart = d.month.slice(5, 7)
      const monthName = t(`common.months.${monthPart}`)
      label = `${dayPart} ${monthName}`.trim()
    }
    return {
      ...d,
      monthLabel: label,
    }
  })

  if (formattedData.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.noData')}</p>
        </CardHeader>
      </Card>
    )
  }

  const displayData = formattedData

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={displayData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            {/* Colours come from the chart tokens in globals.css, not fixed
                hexes: those swap automatically under `.dark`, whereas the old
                hardcoded values left a near-white grid and light-mode series
                colours sitting on the dark card. Income takes the brand violet
                (series slot 1); expense takes amber (slot 3) — a validated
                pair (CVD ΔE 40 light / 31 dark) that stays legible without
                borrowing the reserved red status colour. */}
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.18} />
                <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
            />
            <Tooltip
              formatter={(value: any) => formatCurrency(value as number)}
              itemSorter={(item) => item.dataKey === 'income' ? 0 : 1}
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
            <Legend
              content={() => (
                <div className="flex items-center justify-center gap-4 pt-3" style={{ fontSize: '12px' }}>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--chart-1)' }} />
                    {t('finance.income')}
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--chart-3)' }} />
                    {t('finance.expenses')}
                  </span>
                </div>
              )}
            />
            {/* Expense is drawn first (underneath) so the income area stays on top and visually primary */}
            <Area
              type="monotone"
              dataKey="expense"
              stroke="var(--chart-3)"
              strokeWidth={2}
              fill="url(#colorExpense)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#colorIncome)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
