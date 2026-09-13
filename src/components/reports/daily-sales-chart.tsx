'use client'

import { useTranslations } from 'next-intl'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { DayPoint } from '@/lib/reports/sales-analytics'

/**
 * Revenue by DAY for the selected filter.
 *
 * Always by day — the previous chart switched between hours, days and months
 * depending on the preset, and for "today"/"yesterday" it did not plot the
 * sales at all: it spread the period's total across four hard-coded times of
 * day (09:00 … 18:00 at 15/35/25/25%), which looked like data and was not.
 * A day axis is the one granularity that means the same thing for every
 * preset, and quiet days are plotted as zero rather than skipped, so gaps in
 * trade are visible instead of being smoothed over.
 */
export function DailySalesChart({
  title,
  data,
  lang,
  height = 280,
}: {
  title: string
  data: DayPoint[]
  lang: string
  height?: number
}) {
  const tc = useTranslations('common')

  const locale = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US'
  const shortDay = (day: string) => {
    const d = new Date(`${day}T12:00`)
    if (Number.isNaN(d.getTime())) return day
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
  }

  const points = data.map((p) => ({ ...p, label: shortDay(p.day) }))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-slate-400 dark:text-slate-500"
            style={{ height }}
          >
            {tc('noData')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reportDailyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                // A 30-day window would otherwise print 30 overlapping labels;
                // `preserveStartEnd` keeps the first and last day readable
                // whatever the span.
                interval="preserveStartEnd"
                minTickGap={24}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                  if (v >= 1_000) return `${Math.round(v / 1_000)}k`
                  return String(v)
                }}
              />
              <Tooltip
                formatter={(value: any) => formatCurrency(Number(value))}
                labelFormatter={(label: any) => String(label)}
                cursor={{ stroke: 'var(--chart-1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name={title}
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#reportDailyFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
