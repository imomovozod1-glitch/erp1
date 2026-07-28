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

  // Add mock data if empty for visual demonstration
  const displayData = formattedData.length > 0 ? formattedData : [
    { month: '2026-01', monthLabel: t('common.months.01'), income: 45000000, expense: 28000000 },
    { month: '2026-02', monthLabel: t('common.months.02'), income: 52000000, expense: 31000000 },
    { month: '2026-03', monthLabel: t('common.months.03'), income: 48000000, expense: 27000000 },
    { month: '2026-04', monthLabel: t('common.months.04'), income: 61000000, expense: 35000000 },
    { month: '2026-05', monthLabel: t('common.months.05'), income: 55000000, expense: 32000000 },
    { month: '2026-06', monthLabel: t('common.months.06'), income: 67000000, expense: 38000000 },
  ]

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={displayData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
            />
            <Tooltip
              formatter={(value: any) => formatCurrency(value as number)}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '12px',
              }}
            />
            <Legend
              formatter={(value) => value === 'income' ? t('finance.income') : t('finance.expenses')}
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#colorIncome)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="#f43f5e"
              strokeWidth={2.5}
              fill="url(#colorExpense)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
