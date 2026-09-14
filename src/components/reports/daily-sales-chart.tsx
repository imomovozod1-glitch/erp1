'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { DayPoint } from '@/lib/reports/sales-analytics'

/**
 * Revenue by DAY for exactly the period the filter selected.
 *
 * The day is the only granularity `sales_orders` can honestly draw:
 * `order_date` is a DATE column with no time part, which is why the chart this
 * replaced had to invent an hourly shape for "today" (it spread the period
 * total across 09:00–18:00 at 15/35/25/25%, which looked like data and was
 * not). So one point per day, always — "today" is one bar, "last 7 days" is
 * seven, "this month" is the whole calendar month including the days with no
 * trade, which are drawn as zero rather than skipped.
 *
 * What DOES adapt to the selected period is the presentation, because a single
 * day and a year of days need different drawings:
 *
 *   ≤ 14 days   bars, one label per bar — "8 avg" over "Du"
 *   ≤ 62 days   area, 10 evenly spaced labels — "1 avg · 4 avg · 8 avg …"
 *   > 62 days   area, one label per month — "avg"
 *
 * Month and weekday names come from the tables below rather than
 * `toLocaleDateString`, which returns anything from "sen." to "сентября"
 * depending on the runtime's ICU data — too long for an axis and not the same
 * width twice. Every dated label names its month, and the tooltip and the
 * card's subtitle spell the date out in full.
 */
export function DailySalesChart({
  title,
  data,
  lang,
  height = 300,
}: {
  title: string
  data: DayPoint[]
  lang: string
  height?: number
}) {
  const tc = useTranslations('common')
  const t = useTranslations('reports')

  const months = pickLocale(MONTHS_SHORT, lang)
  const weekdays = pickLocale(WEEKDAYS_SHORT, lang)

  const view = useMemo(() => {
    const days = data.map((p) => p.day)
    const granularity = granularityFor(days)
    // "8 sen" is only unambiguous inside one year — and the open-ended "all
    // time" range routinely spans several.
    const multiYear =
      days.length > 0 && days.some((d) => d.slice(0, 4) !== days[0].slice(0, 4))
    const ticks = pickTicks(days, granularity)

    // Every label carries its month — "8 avg", never a bare "8". Naming the
    // month only where it changes saves ink and costs clarity: the reader who
    // glances at the middle of the axis has to trace back to the last labelled
    // tick to learn what month they are looking at.
    //
    // On the short ranges the weekday is worth having too, so those ticks are
    // stacked on two lines — "8 avg" over "Du" — instead of being crammed onto
    // one long one.
    const labels = new Map<string, string[]>()
    for (const day of ticks) {
      const d = parseDay(day)
      if (!d) {
        labels.set(day, [day])
        continue
      }
      const year = multiYear ? ` '${String(d.getFullYear()).slice(2)}` : ''
      const month = `${months[d.getMonth()]}${year}`
      labels.set(
        day,
        granularity === 'month'
          ? [month]
          : granularity === 'weekday'
            ? [`${d.getDate()} ${month}`, weekdays[d.getDay()]]
            : [`${d.getDate()} ${month}`]
      )
    }

    const total = data.reduce((sum, p) => sum + p.revenue, 0)
    const best = data.reduce<DayPoint | null>(
      (top, p) => (top === null || p.revenue > top.revenue ? p : top),
      null
    )
    return {
      granularity,
      ticks,
      labels,
      average: days.length > 0 ? total / days.length : 0,
      best,
    }
  }, [data, months, weekdays])

  const { granularity, ticks, labels, average, best } = view

  /** The axis label for a day, as one or two stacked lines — precomputed in `view`. */
  const tickLines = (day: string) => labels.get(day) ?? [shortLabel(day, months)]

  /**
   * Ticks are drawn by hand because recharts' built-in `<Text>` renders a
   * single line, and the short ranges want the date over the weekday.
   */
  const renderTick = ({ x, y, payload }: any) => (
    <text x={x} y={y} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
      {tickLines(String(payload?.value ?? '')).map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? 14 : 13}>
          {line}
        </tspan>
      ))}
    </text>
  )

  /** The unabbreviated date, for the tooltip and the subtitle. */
  const fullLabel = (day: string) => {
    const d = parseDay(day)
    if (!d) return day
    return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  const subtitle =
    data.length === 0
      ? ''
      : data.length === 1
        ? fullLabel(data[0].day)
        : `${fullLabel(data[0].day)} — ${fullLabel(data[data.length - 1].day)} · ${t('chart.dayCount', { count: data.length })}`

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const point = payload[0].payload as DayPoint
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
        <p className="mb-1.5 font-semibold text-slate-800 dark:text-slate-200">
          {fullLabel(point.day)}
        </p>
        <p className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
          <span>{t('metric.revenue')}</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(point.revenue)}
          </span>
        </p>
        <p className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400">
          <span>{t('metric.orders')}</span>
          <span>{formatNumber(point.orders)}</span>
        </p>
      </div>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
        {data.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {t('chart.avgPerDay')}{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatCurrency(average)}
              </span>
            </span>
            {best && best.revenue > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {t('chart.bestDay')}{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {shortLabel(best.day, months)} · {formatCurrency(best.revenue)}
                </span>
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-slate-400 dark:text-slate-500"
            style={{ height }}
          >
            {tc('noData')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reportDailyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              {/* The axis is keyed on the ISO day, which is unique, and only
                  formatted for display — a category axis keyed on the label
                  itself collapses the duplicate "sen" ticks a long range
                  produces. `ticks` says which days get a label, and
                  `preserveStartEnd` only ever thins that list further on a
                  narrow screen — never at the cost of the first and last day,
                  which are the two the reader looks for. */}
              <XAxis
                dataKey="day"
                ticks={ticks}
                tick={renderTick}
                height={granularity === 'weekday' ? 42 : 28}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={56}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickFormatter={compactMoney}
              />
              <Tooltip
                content={renderTooltip}
                cursor={
                  granularity === 'weekday'
                    ? { fill: 'var(--muted)', opacity: 0.5 }
                    : { stroke: 'var(--chart-1)', strokeWidth: 1, strokeDasharray: '4 4' }
                }
              />
              {/* The average line is what turns "a tall bar" into "a good day".
                  Skipped on short ranges, where the eye does it unaided. */}
              {data.length >= 5 && average > 0 && (
                <ReferenceLine
                  y={average}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.45}
                />
              )}
              {granularity === 'weekday' ? (
                <Bar
                  dataKey="revenue"
                  name={title}
                  fill="var(--chart-1)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                />
              ) : (
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name={title}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#reportDailyFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const MONTHS_SHORT: Record<string, string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

/** Indexed by `Date.getDay()`, so Sunday first. */
const WEEKDAYS_SHORT: Record<string, string[]> = {
  uz: ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

function pickLocale(table: Record<string, string[]>, lang: string): string[] {
  return table[lang] ?? table.en
}

/** Midday, so a timezone west of UTC can't pull the date back a day. */
function parseDay(day: string): Date | null {
  const d = new Date(`${day}T12:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

type Granularity = 'weekday' | 'day' | 'month'

/**
 * Takes the day list, not just its length: month labels are only meaningful on
 * a CONTIGUOUS series. The "all time" fallback hands over just the days that
 * had sales, and labelling a gap-ridden series by month would print "sen" over
 * a point that is the 16th — so a sparse series stays on day labels however
 * long it is.
 */
function granularityFor(days: string[]): Granularity {
  if (days.length <= 14) return 'weekday'
  if (days.length <= 62) return 'day'
  const span =
    Math.round(
      (new Date(`${days[days.length - 1]}T12:00`).getTime() -
        new Date(`${days[0]}T12:00`).getTime()) / 86_400_000
    ) + 1
  return span === days.length ? 'month' : 'day'
}

/**
 * Which days get a printed label.
 *
 * Chosen explicitly rather than left to recharts' `interval`/`minTickGap`,
 * which thins ticks by pixel width at render time: the last day — the one the
 * reader looks for first — was the one it kept dropping.
 */
function pickTicks(days: string[], granularity: Granularity): string[] {
  if (days.length === 0) return []
  if (granularity === 'weekday') return days

  if (granularity === 'month') {
    const firstOfMonth = days.filter((day) => day.slice(8, 10) === '01')
    const step = Math.ceil(firstOfMonth.length / 12)
    return step <= 1 ? firstOfMonth : firstOfMonth.filter((_, i) => i % step === 0)
  }

  return evenTicks(days, 10)
}

/**
 * `count` labels spread evenly over the series, both ends landing exactly on
 * the first and last day.
 *
 * Stepping forward by a fixed stride and then tacking the last day on is what
 * the naive version did, and on a 31-day month it ended "… 25 · 29 · 31":
 * every gap four days wide except the final one, which is two. Interpolating
 * the positions instead keeps the spacing even all the way across.
 */
function evenTicks(days: string[], count: number): string[] {
  const wanted = Math.min(days.length, count)
  if (wanted <= 1) return days.slice(0, 1)
  const out: string[] = []
  for (let i = 0; i < wanted; i++) {
    const day = days[Math.round((i * (days.length - 1)) / (wanted - 1))]
    if (out[out.length - 1] !== day) out.push(day)
  }
  return out
}

/** Day and month, always both — for labels that stand on their own. */
function shortLabel(day: string, months: string[]): string {
  const d = parseDay(day)
  return d ? `${d.getDate()} ${months[d.getMonth()]}` : day
}

/** Sums here run to nine digits; the axis has room for four. */
function compactMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(Math.round(value))
}
