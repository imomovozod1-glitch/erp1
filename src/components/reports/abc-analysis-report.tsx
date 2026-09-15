'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ReportLayout, type ReportPeriod } from '@/components/reports/report-layout'
import { ReportTable } from '@/components/reports/report-table'
import {
  ABC_METRICS,
  ABC_THRESHOLDS,
  classifyAbc,
  groupItems,
  inRange,
  type AbcClass,
  type AbcMetric,
  type SalesItemRow,
} from '@/lib/reports/sales-analytics'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

/**
 * One hue, three steps. A/B/C is a real three-way classification, so it earns
 * colour — but a ramp of the brand violet says "more important → less
 * important" in a way three unrelated hues (green/amber/red) never do, and it
 * keeps the palette of the reports module to one accent.
 */
const CLASS_STYLES: Record<AbcClass, { chip: string; bar: string }> = {
  A: {
    chip: 'bg-violet-600 text-white',
    bar: 'bg-violet-600',
  },
  B: {
    chip: 'bg-violet-200 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
    bar: 'bg-violet-300',
  },
  C: {
    chip: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    bar: 'bg-slate-300 dark:bg-slate-700',
  },
}

const CLASSES: AbcClass[] = ['A', 'B', 'C']

/**
 * ABC analysis: which products earn the money.
 *
 * Four steps, in the order the method prescribes: pick the indicator (revenue,
 * net profit or units sold), rank the products by it, work out each one's share
 * and the running cumulative share, then cut the curve — the products making
 * the first 80% are A, up to 95% are B, the long tail is C. It is the one
 * report that turns "we sell 900 products" into "40 of them are the business".
 *
 * The indicator matters: a cheap fast-mover is an A by units sold and a C by
 * profit, and stocking decisions made off the wrong one are the whole reason
 * the choice is step one.
 */
export function AbcAnalysisReport({
  lang,
  today,
  items,
}: {
  lang: string
  today: string
  items: SalesItemRow[]
}) {
  const t = useTranslations('reports')

  return (
    <ReportLayout
      lang={lang}
      today={today}
      title={t('cards.abc.title')}
      info={t('cards.abc.desc')}
      storageKey="report_period_abc"
    >
      {(period) => <Body period={period} items={items} />}
    </ReportLayout>
  )
}

/** How each indicator is read off a row and printed in the table. */
const METRIC_FORMAT: Record<AbcMetric, (value: number) => string> = {
  revenue: (value) => formatCurrency(value),
  profit: (value) => formatCurrency(value),
  quantity: (value) => formatNumber(Math.round(value * 100) / 100),
}

function Body({ period, items }: { period: ReportPeriod; items: SalesItemRow[] }) {
  const tc = useTranslations('common')
  const t = useTranslations('reports')
  const { range } = period

  // Step 1 — choose the indicator. Revenue is the default because it is the
  // figure every other report on this screen is already denominated in.
  const [metric, setMetric] = useState<AbcMetric>('revenue')

  // Steps 2-4 — rank by the chosen indicator, compute each share and the
  // cumulative share, cut at 80 / 95. All of it lives in classifyAbc().
  const rows = useMemo(() => {
    const periodItems = items.filter((i) => inRange(i.order_date, range))
    return classifyAbc(
      groupItems(
        periodItems,
        (i) => i.product_id ?? i.product_name,
        (i) => i.product_name
      ),
      metric
    )
  }, [items, range, metric])

  const metricTotal = rows.reduce((sum, r) => sum + Math.max(0, r.metricValue), 0)
  const formatMetric = METRIC_FORMAT[metric]

  const summary = CLASSES.map((cls) => {
    const classRows = rows.filter((r) => r.abc === cls)
    const value = classRows.reduce((sum, r) => sum + r.metricValue, 0)
    return {
      cls,
      count: classRows.length,
      value,
      share: metricTotal > 0 ? (value / metricTotal) * 100 : 0,
      countShare: rows.length > 0 ? (classRows.length / rows.length) * 100 : 0,
    }
  })

  return (
    <>
      {/* Step 1: the indicator picker. Same segmented pill as the period
          filter directly above it — this is the second axis of the same
          question, not a different kind of control. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {t('abc.metricLabel')}:
        </span>
        <div className="flex rounded-lg border bg-slate-100 p-0.5 shadow-inner dark:bg-slate-800">
          {ABC_METRICS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMetric(option)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                metric === option
                  ? 'bg-white text-violet-600 shadow-sm dark:bg-slate-700 dark:text-violet-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              {t(`abc.metric.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((group) => (
          <div
            key={group.cls}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${CLASS_STYLES[group.cls].chip}`}
              >
                {group.cls}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {t(`abc.rule.${group.cls}`)}
              </span>
            </div>
            <p className="mt-3 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatMetric(group.value)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t('abc.groupSummary', {
                count: group.count,
                countShare: group.countShare.toFixed(0),
                share: group.share.toFixed(1),
              })}
            </p>
          </div>
        ))}
      </div>

      {/* The whole classification in one bar: width is the share of PRODUCTS,
          so the Pareto shape — a sliver of items earning most of the money —
          is visible before a single row is read. */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {summary.map((group) =>
              group.countShare > 0 ? (
                <span
                  key={group.cls}
                  className={CLASS_STYLES[group.cls].bar}
                  style={{ width: `${group.countShare}%` }}
                  title={`${group.cls}: ${group.count}`}
                />
              ) : null
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            {t('abc.barHint', { a: ABC_THRESHOLDS.a, b: ABC_THRESHOLDS.b })}
          </p>
        </div>
      )}

      <ReportTable
        title={t('cards.abc.title')}
        rows={rows}
        rowKey={(row) => row.key}
        searchable
        searchPlaceholder={t('searchProduct')}
        filterRow={(row, needle) => row.label.toLowerCase().includes(needle)}
        columns={[
          {
            key: 'rank',
            header: '#',
            className: 'w-10 text-slate-400',
            render: (_row, index) => index + 1,
          },
          {
            key: 'abc',
            header: t('col.abcClass'),
            className: 'w-14',
            render: (row) => (
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${CLASS_STYLES[row.abc].chip}`}
              >
                {row.abc}
              </span>
            ),
          },
          {
            key: 'name',
            header: t('col.product'),
            render: (row) => (
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {row.label || tc('noData')}
              </span>
            ),
          },
          {
            key: 'quantity',
            header: t('col.quantity'),
            align: 'right',
            className: 'hidden md:table-cell',
            render: (row) => formatNumber(Math.round(row.quantity * 100) / 100),
          },
          {
            key: 'revenue',
            header: t('col.revenue'),
            align: 'right',
            className: 'hidden md:table-cell',
            render: (row) => formatCurrency(row.revenue),
          },
          // The ranked-by column repeats revenue or quantity when that is the
          // chosen indicator, and that repetition is the point: it is the one
          // column the table is sorted and classified on, so it is printed
          // last, in bold, right before the cumulative curve it feeds.
          {
            key: 'metric',
            header: t(`abc.metric.${metric}`),
            align: 'right',
            render: (row) => (
              <span
                className={cn(
                  'font-semibold',
                  row.metricValue < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-slate-100'
                )}
              >
                {formatMetric(row.metricValue)}
              </span>
            ),
          },
          {
            key: 'share',
            header: t('col.share'),
            align: 'right',
            className: 'hidden sm:table-cell',
            render: (row) => `${row.metricShare.toFixed(1)}%`,
          },
          {
            key: 'cumulative',
            header: t('col.cumulativeShare'),
            align: 'right',
            render: (row) => (
              <span className="text-slate-500 dark:text-slate-400">
                {row.cumulativeShare.toFixed(1)}%
              </span>
            ),
          },
        ]}
      />
    </>
  )
}
