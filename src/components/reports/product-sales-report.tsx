'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportLayout, type ReportPeriod } from '@/components/reports/report-layout'
import { ReportKpis } from '@/components/reports/report-kpis'
import { SlowMoversSection, type MovementThreshold } from '@/components/reports/products/slow-movers-section'
import { SoldProductsTable } from '@/components/reports/products/sold-products-table'
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
import { formatCurrency, formatNumber } from '@/lib/utils'
import { formatQty } from '@/components/reports/report-format'

// recharts is the bulk of this page's JavaScript and the chart is client-only
// anyway (ResponsiveContainer measures the DOM), so it is fetched on its own.
const DailySalesChart = dynamic(
  () => import('@/components/reports/daily-sales-chart').then((m) => m.DailySalesChart),
  { ssr: false, loading: () => <Skeleton className="h-[400px] w-full rounded-xl" /> }
)

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
  const t = useTranslations('reports')
  const { range, periodLabel } = period

  const [threshold, setThreshold] = useState<MovementThreshold>('0')
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
        maxQuantity: Number(threshold),
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
          { label: t('metric.revenue'), value: formatCurrency(totals.revenue), hint: periodLabel },
          { label: t('metric.profit'), value: formatCurrency(totals.profit), hint: `${totals.margin.toFixed(1)}%` },
          { label: t('metric.soldQty'), value: formatQty(totals.soldQty), hint: periodLabel },
          { label: t('metric.productTypes'), value: formatNumber(sold.length), hint: periodLabel },
          {
            label: t('slowMovers.kpiLabel'),
            value: formatNumber(dead.length),
            hint: t('slowMovers.kpiHint', { value: formatCurrency(tiedUp) }),
          },
        ]}
      />

      <DailySalesChart title={t('dailyRevenue')} data={series} lang={lang} />

      <SoldProductsTable rows={sold} />
      <SlowMoversSection
        rows={dead}
        threshold={threshold}
        onThreshold={setThreshold}
        includeOutOfStock={includeOutOfStock}
        onIncludeOutOfStock={setIncludeOutOfStock}
      />
    </>
  )
}
