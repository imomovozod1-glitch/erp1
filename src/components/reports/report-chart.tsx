'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { ReportColumn } from '@/lib/reports/definitions'
import type { ReportRow } from '@/lib/reports/view'

export const CHART_TYPES = ['bar', 'line', 'area', 'pie'] as const
export type ChartType = (typeof CHART_TYPES)[number]

/**
 * Series palette. Starts on the app's violet accent and moves around the wheel
 * with roughly even spacing, so adjacent series stay distinguishable rather
 * than reading as shades of one another.
 */
const SERIES_COLORS = [
  '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b',
  '#ec4899', '#6366f1', '#14b8a6', '#ef4444',
]

/**
 * A chart is for reading a shape, not for plotting every row. Beyond this many
 * categories the axis becomes unreadable, so bar/pie keep the largest slices
 * and line/area keep the most recent stretch — the table view remains the
 * complete record either way.
 */
const CATEGORY_LIMIT = 24
const SERIES_LIMIT = 400

export function ReportChart({
  columns,
  rows,
  chartType,
  dimension,
  measures,
}: {
  columns: ReportColumn[]
  rows: ReportRow[]
  chartType: ChartType
  dimension: string
  measures: string[]
}) {
  const t = useTranslations('reports')

  const label = (key: string) => t(`col.${key}`)
  const typeOf = (key: string) => columns.find((column) => column.key === key)?.type

  const { data, capped } = useMemo(() => {
    const active = measures.filter(Boolean)
    if (!dimension || active.length === 0) return { data: [], capped: false }

    const mapped = rows.map((row) => {
      const point: Record<string, string | number> = {
        __label: String(row[dimension] ?? '—'),
      }
      for (const measure of active) {
        const n = Number(row[measure])
        point[measure] = Number.isFinite(n) ? n : 0
      }
      return point
    })

    if (chartType === 'bar' || chartType === 'pie') {
      if (mapped.length <= CATEGORY_LIMIT) return { data: mapped, capped: false }
      // Rank by the first measure: that is the one the reader chose to see.
      const ranked = [...mapped].sort(
        (a, b) => Number(b[active[0]] ?? 0) - Number(a[active[0]] ?? 0)
      )
      return { data: ranked.slice(0, CATEGORY_LIMIT), capped: true }
    }

    // Time-ordered charts keep their order; trim the head so the newest data
    // stays on screen.
    if (mapped.length > SERIES_LIMIT) {
      return { data: mapped.slice(-SERIES_LIMIT), capped: true }
    }
    return { data: mapped, capped: false }
  }, [rows, dimension, measures, chartType])

  const formatValue = (value: number, key: string) =>
    typeOf(key) === 'money' ? formatCurrency(value) : formatNumber(value)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        {t('chartPickMeasure')}
      </div>
    )
  }

  const axisProps = {
    stroke: 'currentColor',
    fontSize: 11,
    tickLine: false,
    axisLine: false,
    className: 'text-slate-500 dark:text-slate-400',
  }

  const tooltip = (
    <Tooltip
      cursor={{ fill: 'rgba(124,58,237,.06)' }}
      contentStyle={{
        borderRadius: 12,
        border: '1px solid rgba(148,163,184,.25)',
        background: 'rgba(255,255,255,.96)',
        color: '#0f172a',
        fontSize: 12,
        boxShadow: '0 10px 30px -12px rgba(15,23,42,.35)',
      }}
      formatter={(value: any, name: any) => [formatValue(Number(value), String(name)), label(String(name))]}
    />
  )

  return (
    <div className="p-4">
      <ResponsiveContainer width="100%" height={360}>
        {chartType === 'pie' ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={measures[0]}
              nameKey="__label"
              innerRadius={60}
              outerRadius={130}
              paddingAngle={2}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
              ))}
            </Pie>
            {tooltip}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : chartType === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
            <XAxis dataKey="__label" {...axisProps} />
            <YAxis {...axisProps} width={70} tickFormatter={(v) => formatNumber(Number(v))} />
            {tooltip}
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => label(value)} />
            {measures.map((measure, index) => (
              <Line
                key={measure}
                type="monotone"
                dataKey={measure}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {measures.map((measure, index) => (
                <linearGradient key={measure} id={`fill-${measure}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SERIES_COLORS[index % SERIES_COLORS.length]} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={SERIES_COLORS[index % SERIES_COLORS.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
            <XAxis dataKey="__label" {...axisProps} />
            <YAxis {...axisProps} width={70} tickFormatter={(v) => formatNumber(Number(v))} />
            {tooltip}
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => label(value)} />
            {measures.map((measure, index) => (
              <Area
                key={measure}
                type="monotone"
                dataKey={measure}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2}
                fill={`url(#fill-${measure})`}
              />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
            <XAxis dataKey="__label" {...axisProps} />
            <YAxis {...axisProps} width={70} tickFormatter={(v) => formatNumber(Number(v))} />
            {tooltip}
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => label(value)} />
            {measures.map((measure, index) => (
              <Bar
                key={measure}
                dataKey={measure}
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>

      {capped && (
        <p className="pt-3 text-center text-xs text-amber-600 dark:text-amber-500">
          {t('chartCapped', { count: data.length })}
        </p>
      )}
    </div>
  )
}
