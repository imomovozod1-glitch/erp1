'use client'

import { useMemo, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { Area, Bar, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { compactMoney, dayAxis, type DayAxis } from '@/components/reports/chart/day-axis'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { DayPoint } from '@/lib/reports/sales-analytics'

interface DailySalesChartProps {
  title: string
  data: DayPoint[]
  lang: string
  height?: number
}

/** Average line from this many days up — on shorter ranges the eye does it unaided. */
const AVERAGE_LINE_FROM = 5

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
      {label} <span className="font-semibold text-foreground">{value}</span>
    </span>
  )
}

function ChartHeader({ title, data, axis }: { title: string; data: DayPoint[]; axis: DayAxis }) {
  const t = useTranslations('reports.chart')
  const first = data[0]?.day
  const last = data[data.length - 1]?.day
  const subtitle = !first ? '' : data.length === 1 ? axis.fullLabel(first) : `${axis.fullLabel(first)} — ${axis.fullLabel(last)} · ${t('dayCount', { count: data.length })}`
  return (
    <CardHeader className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {data.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Chip label={t('avgPerDay')} value={formatCurrency(axis.average)} />
          {axis.best && axis.best.revenue > 0 && <Chip label={t('bestDay')} value={`${axis.shortLabel(axis.best.day)} · ${formatCurrency(axis.best.revenue)}`} />}
        </div>
      )}
    </CardHeader>
  )
}

function DayTooltip({ point, axis }: { point: DayPoint; axis: DayAxis }) {
  const t = useTranslations('reports.metric')
  return (
    <div className="rounded-xl border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold text-foreground">{axis.fullLabel(point.day)}</p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>{t('revenue')}</span>
        <span className="font-semibold text-foreground">{formatCurrency(point.revenue)}</span>
      </p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>{t('orders')}</span>
        <span>{formatNumber(point.orders)}</span>
      </p>
    </div>
  )
}

// Drawn by hand: recharts' own tick text is one line, and short ranges stack the date over the weekday.
const tickRenderer = (axis: DayAxis) =>
  function DayTick({ x, y, payload }: any) {
    return (
      <text x={x} y={y} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
        {axis.lines(String(payload?.value ?? '')).map((line, index) => (
          <tspan key={line} x={x} dy={index === 0 ? 14 : 13}>
            {line}
          </tspan>
        ))}
      </text>
    )
  }

function RevenueChart({ title, data, axis }: { title: string; data: DayPoint[]; axis: DayAxis }) {
  const bars = axis.granularity === 'weekday'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="reportDailyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        {/* Keyed on the unique ISO day; `ticks` picks the labelled days, never dropping the first and last. */}
        <XAxis dataKey="day" ticks={axis.ticks} tick={tickRenderer(axis)} height={bars ? 42 : 28} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis axisLine={false} tickLine={false} width={56} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={compactMoney} />
        <Tooltip
          content={({ active, payload }: any) => (active && payload?.length ? <DayTooltip point={payload[0].payload} axis={axis} /> : null)}
          cursor={bars ? { fill: 'var(--muted)', opacity: 0.5 } : { stroke: 'var(--chart-1)', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        {data.length >= AVERAGE_LINE_FROM && axis.average > 0 && <ReferenceLine y={axis.average} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.45} />}
        {bars ? (
          <Bar dataKey="revenue" name={title} fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={56} />
        ) : (
          <Area type="monotone" dataKey="revenue" name={title} stroke="var(--chart-1)" strokeWidth={2} fill="url(#reportDailyFill)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/**
 * Revenue by day for exactly the selected period, quiet days drawn as zero. `order_date`
 * has no time part, so the day is the finest honest granularity; only the drawing adapts:
 * bars up to 14 days, an area with even day labels up to 62, month labels beyond.
 */
export function DailySalesChart({ title, data, lang, height = 300 }: DailySalesChartProps) {
  const t = useTranslations('common')
  const axis = useMemo(() => dayAxis(data, lang), [data, lang])
  return (
    <Card className="border-0 shadow-sm">
      <ChartHeader title={title} data={data} axis={axis} />
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
            {t('noData')}
          </div>
        ) : (
          <div className="h-[min(var(--chart-h),240px)] w-full md:h-(--chart-h)" style={{ '--chart-h': `${height}px` } as CSSProperties}>
            <RevenueChart title={title} data={data} axis={axis} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
