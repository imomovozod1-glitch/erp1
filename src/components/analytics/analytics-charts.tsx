'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

/**
 * Categorical series colours, in fixed order, from the validated palette in
 * globals.css. They are CSS variables so light/dark swap on their own.
 *
 * The previous list was a single-hue violet ramp (#6366f1 → #f5f3ff), which
 * encoded identity by lightness alone: its last three steps were effectively
 * white on a white card, so those slices were invisible and mutually
 * indistinguishable. Distinct hues are what make categories separable.
 */
const SERIES = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
]

/** Slices shown individually before the tail is folded into "Other". */
const TOP_N = 5

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }
const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid var(--border)',
  background: 'var(--popover)',
  color: 'var(--popover-foreground)',
  boxShadow: '0 12px 28px -6px oklch(0.38 0.19 295 / 0.18)',
  fontSize: '12px',
}

interface AnalyticsChartsProps {
  chartData: { month: string; revenue: number }[]
  topProducts: { name: string; totalSum: number }[]
}

export function AnalyticsCharts({ chartData, topProducts }: AnalyticsChartsProps) {
  const t = useTranslations('analytics')
  const tCommon = useTranslations('common')

  // Fold everything past the top N into a single "Other" slice rather than
  // cycling the palette: reusing slot 1 for a 7th product would make two
  // different products the same colour in one chart.
  const head = topProducts.slice(0, TOP_N)
  const tailTotal = topProducts.slice(TOP_N).reduce((sum, p) => sum + (Number(p.totalSum) || 0), 0)
  const slices = tailTotal > 0
    ? [...head, { name: tCommon('other'), totalSum: tailTotal }]
    : head

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Revenue bar chart */}
      <Card className="lg:col-span-2 border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t('salesByMonth')}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-75 text-muted-foreground text-sm">
              {t('noSalesData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value || 0)), t('revenue')]}
                  cursor={{ fill: 'var(--chart-1)', fillOpacity: 0.08 }}
                  contentStyle={TOOLTIP_STYLE}
                />
                {/* Single series — the card title names it, so no legend box. */}
                <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top products donut */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t('topProducts')}</CardTitle>
        </CardHeader>
        <CardContent>
          {slices.length === 0 ? (
            <div className="flex items-center justify-center h-75 text-muted-foreground text-sm">
              {t('noSalesData')}
            </div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="totalSum"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={48}
                    paddingAngle={2}
                  >
                    {slices.map((s, idx) => (
                      // A surface-coloured ring separates touching segments so
                      // adjacent fills never blend into one shape.
                      <Cell
                        key={s.name}
                        fill={SERIES[idx]}
                        stroke="var(--card)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value || 0))}
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend covers every slice that is drawn. It previously listed
                  only the first five of seven, leaving two slices identifiable
                  by colour alone — and by two colours that were invisible. */}
              <div className="mt-3 space-y-1.5">
                {slices.map((p, idx) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden="true"
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: SERIES[idx] }}
                      />
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-30">{p.name}</span>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatCurrency(p.totalSum)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
