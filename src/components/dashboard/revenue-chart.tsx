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
          <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
          <p className="text-sm text-slate-500">{t('common.noData')}</p>
        </CardHeader>
      </Card>
    )
  }

  const displayData = formattedData

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
              itemSorter={(item) => item.dataKey === 'income' ? 0 : 1}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '12px',
              }}
            />
            <Legend
              content={() => (
                <div className="flex items-center justify-center gap-4 pt-3" style={{ fontSize: '12px' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#6366f1' }} />
                    {t('finance.income')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#f43f5e' }} />
                    {t('finance.expenses')}
                  </span>
                </div>
              )}
            />
            {/* Expense is drawn first (underneath) so the income area stays on top and visually primary */}
            <Area
              type="monotone"
              dataKey="expense"
              stroke="#f43f5e"
              strokeWidth={2.5}
              fill="url(#colorExpense)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
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
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
