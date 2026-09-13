'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ReportLayout, type ReportPeriod } from '@/components/reports/report-layout'
import { ReportTable } from '@/components/reports/report-table'
import {
  ABC_THRESHOLDS,
  classifyAbc,
  groupItems,
  inRange,
  type AbcClass,
  type SalesItemRow,
} from '@/lib/reports/sales-analytics'
import { formatCurrency, formatNumber } from '@/lib/utils'

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
 * Products are ranked by revenue over the period and split on the cumulative
 * curve — the ones making the first 80% of revenue are A, up to 95% are B, the
 * long tail is C. It is the one report that turns "we sell 900 products" into
 * "40 of them are the business".
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

function Body({ period, items }: { period: ReportPeriod; items: SalesItemRow[] }) {
  const t = useTranslations('reports')
  const tc = useTranslations('common')
  const { range } = period

  const rows = useMemo(() => {
    const periodItems = items.filter((i) => inRange(i.order_date, range))
    return classifyAbc(
      groupItems(
        periodItems,
        (i) => i.product_id ?? i.product_name,
        (i) => i.product_name
      )
    )
  }, [items, range])

  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0)

  const summary = CLASSES.map((cls) => {
    const classRows = rows.filter((r) => r.abc === cls)
    const revenue = classRows.reduce((sum, r) => sum + r.revenue, 0)
    return {
      cls,
      count: classRows.length,
      revenue,
      share: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      countShare: rows.length > 0 ? (classRows.length / rows.length) * 100 : 0,
    }
  })

  return (
    <>
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
              {formatCurrency(group.revenue)}
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
            render: (row) => (
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(row.revenue)}
              </span>
            ),
          },
          {
            key: 'share',
            header: t('col.share'),
            align: 'right',
            className: 'hidden sm:table-cell',
            render: (row) => `${row.share.toFixed(1)}%`,
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
