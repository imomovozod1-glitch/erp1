'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import {
  Coins, PiggyBank, Receipt, Percent, ShoppingBag, Wallet,
  Package, Tag, Layers, Boxes, Crown, TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { SoldProductsTable } from './sold-products-table'
import { RecentOrders } from '@/components/dashboard/recent-orders'
import { type OverviewWidget } from '@/lib/reports/widgets'
import {
  METRIC_FORMAT,
  SNAPSHOT_METRICS,
  computeMetric,
  type MetricId,
} from '@/lib/reports/metrics'
import { LowStockAlert } from '@/components/dashboard/low-stock-alert'

interface AnalyticsClientProps {
  lang: string
  stats: {
    aggregatedProducts: any[]
    totalRevenue: number
    totalProfit: number
    totalSold: number
    totalOrders: number
    avgOrderValue: number
    chartData: { month: string; revenue: number }[]
    rawItems?: any[]
    rawOrders?: any[]
  }
  recentOrders?: any[]
  lowStockRows?: any[]
  /* The period is owned by ReportsTabs so the selector can live in the page
     header row; this component only reads it. */
  period: string
  customStart: string
  customEnd: string
  periodLabel: string
  visibleMetrics: MetricId[]
  hiddenWidgets: OverviewWidget[]
}

/**
 * Icon and colour per metric. Money-ish figures share the emerald/violet end
 * of the palette, counts sit on blue/amber, and the one warning metric is the
 * only red — so the row is readable as a group before any label is read.
 */
const METRIC_STYLES: Record<MetricId, { icon: LucideIcon; tone: string }> = {
  revenue:           { icon: Coins,         tone: 'emerald' },
  profit:            { icon: PiggyBank,     tone: 'violet' },
  cost:              { icon: Receipt,       tone: 'slate' },
  margin:            { icon: Percent,       tone: 'violet' },
  orders:            { icon: ShoppingBag,   tone: 'blue' },
  avgOrder:          { icon: Wallet,        tone: 'emerald' },
  soldQty:           { icon: Package,       tone: 'amber' },
  avgUnitPrice:      { icon: Tag,           tone: 'emerald' },
  avgItemsPerOrder:  { icon: Layers,        tone: 'blue' },
  productTypes:      { icon: Boxes,         tone: 'blue' },
  topProductRevenue: { icon: Crown,         tone: 'amber' },
  lowStockCount:     { icon: TriangleAlert, tone: 'rose' },
}

const TILE_TONES: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  violet:  'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400',
  blue:    'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
  amber:   'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
  rose:    'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
  slate:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function formatMetric(value: number, format: 'money' | 'number' | 'percent'): string {
  if (format === 'money') return formatCurrency(value)
  // One decimal: a margin is read as a trend, and 42.7% carries that where 43%
  // does not.
  if (format === 'percent') return `${value.toFixed(1)}%`
  return formatNumber(Math.round(value * 100) / 100)
}

const MetricTile = ({
  title, value, subtitle, icon: Icon, tone,
}: {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  tone: string
}) => (
  <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${TILE_TONES[tone] ?? TILE_TONES.slate}`}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-3 truncate text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
      {value}
    </p>
    {subtitle && <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
  </div>
)

export function AnalyticsClient({
  stats, lang, recentOrders = [], lowStockRows = [],
  period, customStart, customEnd, periodLabel,
  visibleMetrics, hiddenWidgets,
}: AnalyticsClientProps) {
  const t = useTranslations('analytics')
  const tc = useTranslations('common')
  const td = useTranslations('dashboard')

  const shows = (id: OverviewWidget) => !hiddenWidgets.includes(id)
  const tr = useTranslations('reports')

  const getFilteredData = () => {
    const rawItems = stats.rawItems ?? []
    const rawOrders = stats.rawOrders ?? []

    if (period === 'all' || !stats.rawItems || !stats.rawOrders) {
      return {
        aggregatedProducts: stats.aggregatedProducts,
        totalRevenue: stats.totalRevenue,
        totalProfit: stats.totalProfit,
        totalSold: stats.totalSold,
        totalOrders: stats.totalOrders,
        avgOrderValue: stats.avgOrderValue,
        chartData: stats.chartData,
      }
    }

    const today = new Date()
    let start: Date | null = null
    let end: Date | null = null

    if (period === 'today') {
      start = new Date()
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (period === 'yesterday') {
      start = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      start.setHours(0, 0, 0, 0)
      end = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      end.setHours(23, 59, 59, 999)
    } else if (period === 'week') {
      start = subDays(today, 7)
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (period === 'month') {
      start = subDays(today, 30)
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (period === 'thisMonth') {
      start = startOfMonth(today)
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (period === 'lastMonth') {
      const lastMonth = subMonths(today, 1)
      start = startOfMonth(lastMonth)
      start.setHours(0, 0, 0, 0)
      end = endOfMonth(lastMonth)
      end.setHours(23, 59, 59, 999)
    } else if (period === 'custom') {
      start = customStart ? new Date(customStart.includes('T') ? customStart : customStart + 'T00:00') : null
      end = customEnd ? new Date(customEnd.includes('T') ? customEnd : customEnd + 'T23:59') : null
    }

    const filteredItems = rawItems.filter(item => {
      if (!item.sales_orders?.order_date) return false
      const d = new Date(item.sales_orders.order_date)
      return (!start || d >= start) && (!end || d <= end)
    })

    const filteredOrders = rawOrders.filter(o => {
      if (!o.order_date) return false
      const d = new Date(o.order_date)
      return (!start || d >= start) && (!end || d <= end)
    })

    // Aggregate products. Each sale of the same product can carry a different
    // realized unit_cost (the entire point of FIFO/LIFO/AVECO — later sales draw
    // from different cost layers), so cost must accumulate per line
    // (`quantity * costPrice` summed across every sale), never a single costPrice
    // from whichever line happened to be seen first multiplied by total quantity.
    const productMap: Record<string, { name: string; totalCost: number; sellingPrice: number; quantity: number; totalSum: number }> = {}
    filteredItems.forEach((item: any) => {
      const productName = item.products?.name ?? 'Unknown'
      // Realized cost at time of sale (FIFO/LIFO/AVECO) when available; falls back to
      // the product's current cost_price for sales made before this column existed.
      const costPrice = item.unit_cost ?? item.products?.cost_price ?? 0
      const sellingPrice = item.unit_price ?? item.products?.price ?? 0

      if (!productMap[productName]) {
        productMap[productName] = {
          name: productName,
          totalCost: 0,
          sellingPrice,
          quantity: 0,
          totalSum: 0,
        }
      }
      productMap[productName].quantity += item.quantity
      // `net_total_price` is `total_price` minus this order's share of its
      // general discount (see orderDiscountFactors in queries.ts); the raw
      // column would overstate revenue on every discounted sale.
      productMap[productName].totalSum += item.net_total_price ?? item.total_price
      productMap[productName].totalCost += costPrice * item.quantity
    })

    const aggregatedProducts = Object.values(productMap).map(p => ({
      ...p,
      // Weighted-average cost across every sale, for display only — profit
      // itself is computed from the accumulated totalCost, not this average.
      costPrice: p.quantity > 0 ? p.totalCost / p.quantity : 0,
      profit: p.totalSum - p.totalCost,
    })).sort((a, b) => b.totalSum - a.totalSum)

    const totalRevenue = aggregatedProducts.reduce((sum, p) => sum + p.totalSum, 0)
    const totalCost = aggregatedProducts.reduce((sum, p) => sum + p.totalCost, 0)
    const totalProfit = totalRevenue - totalCost
    const totalSold = aggregatedProducts.reduce((sum, p) => sum + p.quantity, 0)
    const totalOrdersCount = filteredOrders.length
    const avgOrderValue = totalOrdersCount ? totalRevenue / totalOrdersCount : 0

    // Chart data construction
    let chartData: { month: string; revenue: number }[] = []
    if (period === 'month' || period === 'week') {
      const dailyData: Record<string, number> = {}
      filteredOrders.forEach((o: any) => {
        const day = o.order_date?.split('T')[0] ?? 'unknown'
        if (!dailyData[day]) dailyData[day] = 0
        dailyData[day] += o.total_amount ?? 0
      })
      chartData = Object.entries(dailyData)
        .map(([day, revenue]) => ({
          month: day,
          revenue,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
    } else if (period === 'custom') {
      const start = customStart ? new Date(customStart) : null
      const end = customEnd ? new Date(customEnd) : null
      const diffMs = (end?.getTime() ?? 0) - (start?.getTime() ?? 0)
      const diffDays = diffMs / (1000 * 60 * 60 * 24)

      if (diffDays <= 2) {
        // Hourly breakdown
        const hourlyData: Record<string, number> = {}
        filteredOrders.forEach((o: any) => {
          if (!o.order_date) return
          const hour = new Date(o.order_date).toLocaleTimeString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })
          if (!hourlyData[hour]) hourlyData[hour] = 0
          hourlyData[hour] += o.total_amount ?? 0
        })
        chartData = Object.entries(hourlyData)
          .map(([hour, revenue]) => ({
            month: hour,
            revenue,
          }))
          .sort((a, b) => a.month.localeCompare(b.month))
      } else if (diffDays <= 60) {
        // Daily breakdown
        const dailyData: Record<string, number> = {}
        filteredOrders.forEach((o: any) => {
          const day = o.order_date?.split('T')[0] ?? 'unknown'
          if (!dailyData[day]) dailyData[day] = 0
          dailyData[day] += o.total_amount ?? 0
        })
        chartData = Object.entries(dailyData)
          .map(([day, revenue]) => ({
            month: day,
            revenue,
          }))
          .sort((a, b) => a.month.localeCompare(b.month))
      } else {
        // Monthly breakdown
        const monthlyData: Record<string, number> = {}
        filteredOrders.forEach((o: any) => {
          const month = o.order_date?.slice(0, 7) ?? 'unknown'
          if (!monthlyData[month]) monthlyData[month] = 0
          monthlyData[month] += o.total_amount ?? 0
        })
        chartData = Object.entries(monthlyData)
          .map(([month, revenue]) => ({
            month: month,
            revenue,
          }))
          .sort((a, b) => a.month.localeCompare(b.month))
      }
    } else {
      // Today & Yesterday: Hourly distribution simulation
      chartData = [
        { month: '09:00', revenue: totalRevenue * 0.15 },
        { month: '12:00', revenue: totalRevenue * 0.35 },
        { month: '15:00', revenue: totalRevenue * 0.25 },
        { month: '18:00', revenue: totalRevenue * 0.25 },
      ]
    }

    return {
      aggregatedProducts,
      totalRevenue,
      totalProfit,
      totalSold,
      totalOrders: totalOrdersCount,
      avgOrderValue,
      chartData,
    }
  }

  const {
    aggregatedProducts,
    totalRevenue,
    totalProfit,
    totalSold,
    totalOrders,
    chartData,
  } = getFilteredData()

  const formattedChartData = chartData.map((d) => {
    let label = d.month
    if (d.month.length === 7 && d.month.includes('-')) {
      const monthPart = d.month.slice(5, 7)
      label = tc(`months.${monthPart}`)
    }
    return {
      ...d,
      monthLabel: label,
    }
  })

  // Top 5 products
  const topProducts = aggregatedProducts.slice(0, 5)

  const lowStockAll = (lowStockRows ?? []).filter((p) => p.stock < p.min_stock)
  const lowStock = lowStockAll.slice(0, 5)

  /*
   * Everything the metric catalogue needs, already narrowed to the selected
   * period by getFilteredData() above — except the stock count, which is a
   * live snapshot of the warehouse and has no period to narrow to. The tile
   * for it is labelled accordingly (SNAPSHOT_METRICS).
   */
  const metricInput = {
    totalRevenue,
    totalProfit,
    totalSold,
    totalOrders,
    productTypes: aggregatedProducts.length,
    topProductRevenue: aggregatedProducts[0]?.totalSum ?? 0,
    lowStockCount: lowStockAll.length,
  }

  return (
    <div className="space-y-6">
      {/* KPI tiles — driven by the metric catalogue, not a fixed list.
          `auto-fit` lets the row hold anywhere from one to twelve tiles
          without a breakpoint per count. */}
      {shows('kpi') && visibleMetrics.length > 0 && (
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
        {visibleMetrics.map((id) => {
          const style = METRIC_STYLES[id]
          return (
            <MetricTile
              key={id}
              title={tr(`metric.${id}`)}
              value={formatMetric(computeMetric(id, metricInput), METRIC_FORMAT[id])}
              subtitle={SNAPSHOT_METRICS.includes(id) ? tr('snapshotMetric') : periodLabel}
              icon={style.icon}
              tone={style.tone}
            />
          )
        })}
      </div>
      )}

      {(shows('revenueChart') || shows('topProducts')) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Over Time Chart */}
        {shows('revenueChart') && (
        // Widens to the full row when its neighbour is hidden, so a hidden
        // block leaves no dead column behind.
        <Card className={`border-0 shadow-sm ${shows('topProducts') ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">{t('revenueOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            {formattedChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                {tc('noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={formattedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(v) => {
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                      if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
                      return v
                    }}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value as number)}
                    cursor={{ stroke: 'var(--chart-1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                      boxShadow: '0 12px 28px -6px oklch(0.38 0.19 295 / 0.18)',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#colorRev)"
                    name={t('revenue')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        )}

        {/* Top Products */}
        {shows('topProducts') && (
        <Card className={`border-0 shadow-sm ${shows('revenueChart') ? '' : 'lg:col-span-3'}`}>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">{t('topProducts')}</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="text-slate-500 dark:text-slate-400 text-sm">{tc('noData')}</div>
            ) : (
              <div className="space-y-5">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-sm">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]">{p.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.quantity} {tc('pieces')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(p.totalSum)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
      )}

      {/* Recent Orders + Low Stock — moved here from the dashboard */}
      {(shows('recentOrders') || shows('lowStock')) && (
      <div className="grid gap-6 lg:grid-cols-3">
        {shows('recentOrders') && (
        <div className={shows('lowStock') ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <RecentOrders orders={recentOrders} lang={lang} title={td('recentOrdersTitle')} />
        </div>
        )}
        {shows('lowStock') && (
        <div className={shows('recentOrders') ? '' : 'lg:col-span-3'}>
          <LowStockAlert products={lowStock} lang={lang} />
        </div>
        )}
      </div>
      )}

      {/* Sold Products Table */}
      {shows('soldProducts') && (
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('soldProducts')}</h2>
        <SoldProductsTable products={aggregatedProducts} lang={lang} />
      </div>
      )}
    </div>
  )
}
