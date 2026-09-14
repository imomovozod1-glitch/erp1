'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Coins, Layers, ShoppingBag, Users, Wallet } from 'lucide-react'
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
import { formatCurrency, formatNumber } from '@/lib/utils'

export type SalesDimension = 'seller' | 'customer'

/**
 * "Sales by employee" and "sales by customer" — the same report with a
 * different grouping key.
 *
 * Kept as one component rather than two files that will drift: both rank the
 * same measures (receipts, units, revenue, average check, profit, share of
 * total) and the only thing that differs is which id the lines are summed by
 * and what an unnamed group is called.
 */
export function GroupedSalesReport({
  lang,
  today,
  dimension,
  orders,
  items,
}: {
  lang: string
  today: string
  dimension: SalesDimension
  orders: SalesOrderRow[]
  items: SalesItemRow[]
}) {
  const t = useTranslations('reports')
  const cardKey = dimension === 'seller' ? 'employees' : 'customers'

  return (
    <ReportLayout
      lang={lang}
      today={today}
      title={t(`cards.${cardKey}.title`)}
      info={t(`cards.${cardKey}.desc`)}
      storageKey={`report_period_${dimension}`}
    >
      {(period) => (
        <Body period={period} lang={lang} dimension={dimension} orders={orders} items={items} />
      )}
    </ReportLayout>
  )
}

function Body({
  period,
  lang,
  dimension,
  orders,
  items,
}: {
  period: ReportPeriod
  lang: string
  dimension: SalesDimension
  orders: SalesOrderRow[]
  items: SalesItemRow[]
}) {
  const tc = useTranslations('common')
  const t = useTranslations('reports')
  const { range, periodLabel } = period

  const unnamed = dimension === 'seller' ? tc('unassigned') : t('walkInCustomer')

  const view = useMemo(() => {
    const periodOrders = orders.filter((o) => inRange(o.order_date, range))
    const periodItems = items.filter((i) => inRange(i.order_date, range))

    // Names live on the ORDER, not on the line, so the lookup is built from
    // the orders once instead of re-scanned per line.
    const names = new Map<string, string>()
    for (const order of periodOrders) {
      const id = dimension === 'seller' ? order.seller_id : order.customer_id
      const name = dimension === 'seller' ? order.seller_name : order.customer_name
      if (id) names.set(id, name || unnamed)
    }

    const keyOf = (item: SalesItemRow) =>
      (dimension === 'seller' ? item.seller_id : item.customer_id) ?? '—'

    return {
      totals: computeTotals(periodOrders, periodItems),
      series: dailySeries(periodOrders, periodItems, range),
      groups: groupItems(periodItems, keyOf, (item) => names.get(keyOf(item)) ?? unnamed),
    }
  }, [orders, items, range, dimension, unnamed])

  const { totals, series, groups } = view

  return (
    <>
      <ReportKpis
        items={[
          { label: t('metric.revenue'), value: formatCurrency(totals.revenue), hint: periodLabel, icon: Coins },
          { label: t('metric.orders'), value: formatNumber(totals.orders), hint: periodLabel, icon: ShoppingBag },
          { label: t('metric.avgOrder'), value: formatCurrency(totals.avgCheck), hint: periodLabel, icon: Wallet },
          { label: t('metric.avgItemsPerOrder'), value: totals.avgItemsPerCheck.toFixed(2), hint: periodLabel, icon: Layers },
          {
            label: dimension === 'seller' ? t('activeSellers') : t('activeCustomers'),
            value: formatNumber(groups.length),
            hint: periodLabel,
            icon: Users,
          },
        ]}
      />

      <DailySalesChart title={t('dailyRevenue')} data={series} lang={lang} />

      <ReportTable
        title={dimension === 'seller' ? t('cards.employees.title') : t('cards.customers.title')}
        rows={groups}
        rowKey={(row) => row.key}
        searchable
        searchPlaceholder={tc('search')}
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
            header: dimension === 'seller' ? t('col.seller') : t('col.customer'),
            render: (row) => (
              <span className="font-medium text-slate-800 dark:text-slate-200">{row.label}</span>
            ),
          },
          {
            key: 'orders',
            header: t('col.orders'),
            align: 'right',
            render: (row) => formatNumber(row.orders),
          },
          {
            key: 'quantity',
            header: t('col.quantity'),
            align: 'right',
            className: 'hidden md:table-cell',
            render: (row) => formatNumber(Math.round(row.quantity * 100) / 100),
          },
          {
            key: 'avgCheck',
            header: t('col.avgCheck'),
            align: 'right',
            className: 'hidden lg:table-cell',
            render: (row) => formatCurrency(row.avgCheck),
          },
          {
            key: 'profit',
            header: t('col.profit'),
            align: 'right',
            className: 'hidden lg:table-cell',
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
          {
            key: 'share',
            header: t('col.share'),
            align: 'right',
            className: 'hidden sm:table-cell',
            render: (row) => (
              // The bar is the point: a column of percentages needs reading,
              // a column of bars is scanned in one pass.
              <div className="flex items-center justify-end gap-2">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <span
                    className="block h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.min(100, row.share)}%` }}
                  />
                </span>
                <span className="w-10 text-right text-xs text-slate-500 dark:text-slate-400">
                  {row.share.toFixed(1)}%
                </span>
              </div>
            ),
          },
        ]}
      />
    </>
  )
}
