'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Coins,
  Layers,
  Package,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { ReportLayout, type ReportPeriod } from '@/components/reports/report-layout'
import { ReportKpis } from '@/components/reports/report-kpis'
import { DailySalesChart } from '@/components/reports/daily-sales-chart'
import { ReportTable } from '@/components/reports/report-table'
import {
  computeTotals,
  dailySeries,
  groupItems,
  inRange,
  type SalesItemRow,
  type SalesOrderRow,
} from '@/lib/reports/sales-analytics'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

/**
 * "Umumiy savdo" — the headline sales figures for a period, the daily revenue
 * curve, and the receipts behind them.
 */
export function SalesOverviewReport({
  lang,
  today,
  orders,
  items,
}: {
  lang: string
  today: string
  orders: SalesOrderRow[]
  items: SalesItemRow[]
}) {
  const t = useTranslations('reports')

  return (
    <ReportLayout
      lang={lang}
      today={today}
      title={t('cards.sales.title')}
      info={t('cards.sales.desc')}
      storageKey="report_period_sales"
    >
      {(period) => <Body period={period} lang={lang} orders={orders} items={items} />}
    </ReportLayout>
  )
}

/**
 * The report body is its own component, not inline JSX in the render prop:
 * the period-dependent aggregations below are memoised, and hooks called
 * inside a parent's render prop would belong to the parent's hook list.
 */
function Body({
  period,
  lang,
  orders,
  items,
}: {
  period: ReportPeriod
  lang: string
  orders: SalesOrderRow[]
  items: SalesItemRow[]
}) {
  const t = useTranslations('reports')
  const tc = useTranslations('common')
  const { range, periodLabel } = period

  const view = useMemo(() => {
    const periodOrders = orders.filter((o) => inRange(o.order_date, range))
    const periodItems = items.filter((i) => inRange(i.order_date, range))
    return {
      totals: computeTotals(periodOrders, periodItems),
      series: dailySeries(periodOrders, periodItems, range),
      topProducts: groupItems(
        periodItems,
        (i) => i.product_id ?? i.product_name,
        (i) => i.product_name
      ).slice(0, 10),
      recent: [...periodOrders].sort((a, b) =>
        (b.order_date ?? '').localeCompare(a.order_date ?? '')
      ),
    }
  }, [orders, items, range])

  const { totals, series, topProducts, recent } = view

  return (
    <>
      <ReportKpis
        items={[
          { label: t('metric.revenue'), value: formatCurrency(totals.revenue), hint: periodLabel, icon: Coins },
          { label: t('metric.profit'), value: formatCurrency(totals.profit), hint: `${totals.margin.toFixed(1)}%`, icon: PiggyBank },
          { label: t('metric.cost'), value: formatCurrency(totals.cost), hint: periodLabel, icon: Receipt },
          { label: t('metric.orders'), value: formatNumber(totals.orders), hint: periodLabel, icon: ShoppingBag },
          // The two "per receipt" figures the shop floor actually asks for:
          // how much a customer spends, and how many items they leave with.
          { label: t('metric.avgOrder'), value: formatCurrency(totals.avgCheck), hint: periodLabel, icon: Wallet },
          { label: t('metric.avgItemsPerOrder'), value: totals.avgItemsPerCheck.toFixed(2), hint: periodLabel, icon: Layers },
          { label: t('metric.soldQty'), value: formatNumber(Math.round(totals.soldQty * 100) / 100), hint: periodLabel, icon: Package },
        ]}
      />

      <DailySalesChart title={t('dailyRevenue')} data={series} lang={lang} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportTable
          title={t('topProductsTitle')}
          rows={topProducts}
          rowKey={(row) => row.key}
          pageSize={10}
          columns={[
            {
              key: 'rank',
              header: '#',
              className: 'w-10 text-slate-400',
              render: (_row, index) => index + 1,
            },
            { key: 'name', header: t('col.product'), render: (row) => row.label || tc('noData') },
            {
              key: 'quantity',
              header: t('col.quantity'),
              align: 'right',
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
          ]}
        />

        <ReportTable
          title={t('recentSales')}
          rows={recent}
          rowKey={(row) => row.id}
          pageSize={10}
          searchable
          searchPlaceholder={t('searchOrderOrCustomer')}
          filterRow={(row, needle) =>
            row.order_number.toLowerCase().includes(needle) ||
            row.customer_name.toLowerCase().includes(needle)
          }
          columns={[
            {
              key: 'order',
              header: t('col.order_number'),
              render: (row) => (
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {row.order_number}
                </span>
              ),
            },
            {
              key: 'date',
              header: t('col.date'),
              className: 'hidden sm:table-cell',
              render: (row) => (row.order_date ? formatDate(row.order_date) : '—'),
            },
            {
              key: 'customer',
              header: t('col.customer'),
              render: (row) => row.customer_name || tc('unassigned'),
            },
            {
              key: 'total',
              header: t('col.revenue'),
              align: 'right',
              render: (row) => formatCurrency(row.total_amount),
            },
          ]}
        />
      </div>
    </>
  )
}
