'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Boxes, Coins, Package, TrendingDown } from 'lucide-react'
import { ReportLayout, type ReportPeriod } from '@/components/reports/report-layout'
import { ReportKpis } from '@/components/reports/report-kpis'
import { DailySalesChart } from '@/components/reports/daily-sales-chart'
import { ReportTable } from '@/components/reports/report-table'
import {
  computeTotals,
  dailySeries,
  groupItems,
  inRange,
  slowMovers,
  type CatalogProductRow,
  type SalesItemRow,
  type SalesOrderRow,
} from '@/lib/reports/sales-analytics'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

/** How many units still counts as "barely moving" in the period. */
const MOVEMENT_THRESHOLDS = [0, 3, 10] as const

/**
 * "Mahsulotlar bo'yicha savdo" — what sold, and, just as importantly, what
 * didn't.
 *
 * The dead-stock half is the reason this report exists separately from the
 * overview's top-ten list: a best-seller table answers a question the owner
 * already knows the answer to, while the money stuck in products nobody buys
 * is invisible until something goes looking for it.
 */
export function ProductSalesReport({
  lang,
  today,
  orders,
  items,
  products,
}: {
  lang: string
  today: string
  orders: SalesOrderRow[]
  items: SalesItemRow[]
  products: CatalogProductRow[]
}) {
  const t = useTranslations('reports')

  return (
    <ReportLayout
      lang={lang}
      today={today}
      title={t('cards.products.title')}
      info={t('cards.products.desc')}
      storageKey="report_period_products"
    >
      {(period) => (
        <Body
          period={period}
          lang={lang}
          today={today}
          orders={orders}
          items={items}
          products={products}
        />
      )}
    </ReportLayout>
  )
}

function Body({
  period,
  lang,
  today,
  orders,
  items,
  products,
}: {
  period: ReportPeriod
  lang: string
  today: string
  orders: SalesOrderRow[]
  items: SalesItemRow[]
  products: CatalogProductRow[]
}) {
  const tc = useTranslations('common')
  const t = useTranslations('reports')
  const { range, periodLabel } = period

  const [threshold, setThreshold] = useState<number>(0)
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false)

  const view = useMemo(() => {
    const periodOrders = orders.filter((o) => inRange(o.order_date, range))
    const periodItems = items.filter((i) => inRange(i.order_date, range))
    return {
      totals: computeTotals(periodOrders, periodItems),
      series: dailySeries(periodOrders, periodItems, range),
      sold: groupItems(
        periodItems,
        (i) => i.product_id ?? i.product_name,
        (i) => i.product_name
      ),
      periodItems,
    }
  }, [orders, items, range])

  const dead = useMemo(
    () =>
      slowMovers(products, view.periodItems, items, new Date(`${today}T12:00`), {
        maxQuantity: threshold,
        includeOutOfStock,
      }),
    [products, view.periodItems, items, today, threshold, includeOutOfStock]
  )

  const { totals, series, sold } = view
  const tiedUp = dead.reduce((sum, row) => sum + row.tiedUpValue, 0)

  return (
    <>
      <ReportKpis
        items={[
          { label: t('metric.revenue'), value: formatCurrency(totals.revenue), hint: periodLabel, icon: Coins },
          { label: t('metric.profit'), value: formatCurrency(totals.profit), hint: `${totals.margin.toFixed(1)}%` },
          { label: t('metric.soldQty'), value: formatNumber(Math.round(totals.soldQty * 100) / 100), hint: periodLabel, icon: Package },
          { label: t('metric.productTypes'), value: formatNumber(sold.length), hint: periodLabel, icon: Boxes },
          {
            label: t('slowMovers.kpiLabel'),
            value: formatNumber(dead.length),
            hint: t('slowMovers.kpiHint', { value: formatCurrency(tiedUp) }),
            icon: TrendingDown,
          },
        ]}
      />

      <DailySalesChart title={t('dailyRevenue')} data={series} lang={lang} />

      <ReportTable
        title={t('cards.products.title')}
        rows={sold}
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
            render: (row) => formatNumber(Math.round(row.quantity * 100) / 100),
          },
          {
            key: 'orders',
            header: t('col.orders'),
            align: 'right',
            className: 'hidden md:table-cell',
            render: (row) => formatNumber(row.orders),
          },
          {
            key: 'cost',
            header: t('col.cost'),
            align: 'right',
            className: 'hidden lg:table-cell',
            render: (row) => formatCurrency(row.cost),
          },
          {
            key: 'profit',
            header: t('col.profit'),
            align: 'right',
            className: 'hidden md:table-cell',
            render: (row) => formatCurrency(row.profit),
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
        ]}
      />

      {/* ── Dead and slow stock ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('slowMovers.title')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('slowMovers.desc')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              {MOVEMENT_THRESHOLDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setThreshold(value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    threshold === value
                      ? 'bg-white text-violet-600 dark:bg-slate-700 dark:text-violet-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  )}
                >
                  {value === 0
                    ? t('slowMovers.neverSold')
                    : t('slowMovers.upToUnits', { count: value })}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIncludeOutOfStock((v) => !v)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                includeOutOfStock
                  ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                  : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
              )}
            >
              <span
                className={cn(
                  'h-3 w-3 rounded-full border-2',
                  includeOutOfStock
                    ? 'border-violet-600 bg-violet-600'
                    : 'border-slate-300 dark:border-slate-600'
                )}
              />
              {t('slowMovers.includeOutOfStock')}
            </button>
          </div>
        </div>

        <ReportTable
          rows={dead}
          rowKey={(row) => row.id}
          searchable
          searchPlaceholder={t('searchProduct')}
          filterRow={(row, needle) =>
            row.name.toLowerCase().includes(needle) || row.sku.toLowerCase().includes(needle)
          }
          columns={[
            {
              key: 'name',
              header: t('col.product'),
              render: (row) => (
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{row.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{row.sku}</p>
                </div>
              ),
            },
            {
              key: 'stock',
              header: t('col.stock'),
              align: 'right',
              render: (row) => formatNumber(Math.round(row.stock * 100) / 100),
            },
            {
              key: 'sold',
              header: t('slowMovers.soldInPeriod'),
              align: 'right',
              className: 'hidden sm:table-cell',
              render: (row) => formatNumber(Math.round(row.quantity * 100) / 100),
            },
            {
              key: 'lastSale',
              header: t('slowMovers.lastSale'),
              align: 'right',
              className: 'hidden md:table-cell',
              render: (row) =>
                row.daysSinceLastSale === null ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    {t('slowMovers.neverSoldShort')}
                  </span>
                ) : (
                  t('slowMovers.daysAgo', { count: row.daysSinceLastSale })
                ),
            },
            {
              key: 'tiedUp',
              header: t('slowMovers.tiedUpValue'),
              align: 'right',
              render: (row) => (
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(row.tiedUpValue)}
                </span>
              ),
            },
          ]}
          footer={
            dead.length > 0 ? (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('slowMovers.totalTiedUp')}
                </span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(tiedUp)}
                </span>
              </div>
            ) : null
          }
        />
      </div>
    </>
  )
}
