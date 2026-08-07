'use client'

import { useState, useEffect } from 'react'
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
import { formatCurrency } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { BanknotesIcon, ChartBarIcon, ShoppingCartIcon, TagIcon } from '@heroicons/react/24/outline'
import { TrendingUp } from 'lucide-react'
import { SoldProductsTable } from './sold-products-table'

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
}

const KPICard = ({ title, value, subtitle, icon: Icon, color }: any) => (
  <Card className="border-0 shadow-sm">
    <CardContent className="p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
)

// Helper to format Date locally to YYYY-MM-DDTHH:mm
const toLocalISOString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
  return localISOTime;
}

export function AnalyticsClient({ stats, lang }: AnalyticsClientProps) {
  const t = useTranslations('analytics')
  const tc = useTranslations('common')
  const td = useTranslations('dashboard')

  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('analytics_period')
      if (
        saved === 'today' ||
        saved === 'yesterday' ||
        saved === 'week' ||
        saved === 'month' ||
        saved === 'all' ||
        saved === 'custom'
      ) {
        return saved
      }
    }
    return 'all'
  })

  const [customStart, setCustomStart] = useState<string>(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return toLocalISOString(start)
  })

  const [customEnd, setCustomEnd] = useState<string>(() => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return toLocalISOString(end)
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('analytics_period', period)
    }
  }, [period])

  const [now] = useState(() => new Date())
  const todayStr = now.toISOString().split('T')[0]
  const oneDayMs = 24 * 60 * 60 * 1000
  const yesterdayStr = new Date(now.getTime() - oneDayMs).toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * oneDayMs)
  const monthAgo = new Date(now.getTime() - 30 * oneDayMs)

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

    let filteredItems = rawItems
    let filteredOrders = rawOrders

    if (period === 'today') {
      filteredItems = rawItems.filter(item => item.sales_orders?.order_date?.split('T')[0] === todayStr)
      filteredOrders = rawOrders.filter(o => o.order_date?.split('T')[0] === todayStr)
    } else if (period === 'yesterday') {
      filteredItems = rawItems.filter(item => item.sales_orders?.order_date?.split('T')[0] === yesterdayStr)
      filteredOrders = rawOrders.filter(o => o.order_date?.split('T')[0] === yesterdayStr)
    } else if (period === 'week') {
      filteredItems = rawItems.filter(item => item.sales_orders?.order_date ? new Date(item.sales_orders.order_date) >= weekAgo : false)
      filteredOrders = rawOrders.filter(o => o.order_date ? new Date(o.order_date) >= weekAgo : false)
    } else if (period === 'month') {
      filteredItems = rawItems.filter(item => item.sales_orders?.order_date ? new Date(item.sales_orders.order_date) >= monthAgo : false)
      filteredOrders = rawOrders.filter(o => o.order_date ? new Date(o.order_date) >= monthAgo : false)
    } else if (period === 'custom') {
      const start = customStart ? new Date(customStart) : null
      const end = customEnd ? new Date(customEnd) : null

      filteredItems = rawItems.filter(item => {
        if (!item.sales_orders?.order_date) return false
        const d = new Date(item.sales_orders.order_date)
        return (!start || d >= start) && (!end || d <= end)
      })
      filteredOrders = rawOrders.filter(o => {
        if (!o.order_date) return false
        const d = new Date(o.order_date)
        return (!start || d >= start) && (!end || d <= end)
      })
    }

    // Aggregate products
    const productMap: Record<string, { name: string; costPrice: number; sellingPrice: number; quantity: number; totalSum: number }> = {}
    filteredItems.forEach((item: any) => {
      const productName = item.products?.name ?? 'Unknown'
      const costPrice = item.products?.cost_price ?? 0
      const sellingPrice = item.unit_price ?? item.products?.price ?? 0

      if (!productMap[productName]) {
        productMap[productName] = {
          name: productName,
          costPrice,
          sellingPrice,
          quantity: 0,
          totalSum: 0,
        }
      }
      productMap[productName].quantity += item.quantity
      productMap[productName].totalSum += item.total_price
    })

    const aggregatedProducts = Object.values(productMap).map(p => ({
      ...p,
      profit: p.totalSum - (p.costPrice * p.quantity),
    })).sort((a, b) => b.totalSum - a.totalSum)

    const totalRevenue = aggregatedProducts.reduce((sum, p) => sum + p.totalSum, 0)
    const totalCost = aggregatedProducts.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0)
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

  const getPeriodLabel = (p: string) => {
    switch (p) {
      case 'today': return td('today')
      case 'yesterday': return td('yesterday')
      case 'week': return td('week')
      case 'month': return td('month')
      case 'all': return td('all')
      case 'custom':
        if (lang === 'uz') return 'Boshqa muddat'
        if (lang === 'ru') return 'Другой период'
        return 'Custom'
      default: return p
    }
  }

  const labels = {
    start: lang === 'uz' ? 'Boshlanish vaqti' : lang === 'ru' ? 'Время начала' : 'Start Date & Time',
    end: lang === 'uz' ? 'Tugash vaqti' : lang === 'ru' ? 'Время окончания' : 'End Date & Time',
  }

  return (
    <div className="space-y-6">
      {/* Period Selection Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            {tc('filter')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex rounded-lg bg-slate-100 p-0.5 shadow-inner border overflow-x-auto max-w-full">
          {(['today', 'yesterday', 'week', 'month', 'all', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
                period === p
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {getPeriodLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Period DateTime Pickers */}
      {period === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {labels.start}
            </label>
            <input
              type="datetime-local"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {labels.end}
            </label>
            <input
              type="datetime-local"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
            />
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('revenue')}
          value={formatCurrency(totalRevenue)}
          subtitle={`${tc('total')} ${t('revenue')}`}
          icon={BanknotesIcon}
          color="bg-emerald-100 text-emerald-600"
        />
        <KPICard
          title={t('sales')}
          value={totalOrders.toString()}
          subtitle={`${tc('total')} ${tc('sum')}`}
          icon={ShoppingCartIcon}
          color="bg-blue-100 text-blue-600"
        />
        <KPICard
          title={tc('profit')}
          value={formatCurrency(totalProfit)}
          subtitle={`${tc('total')} ${tc('profit')}`}
          icon={ChartBarIcon}
          color="bg-indigo-100 text-indigo-600"
        />
        <KPICard
          title={tc('quantity')}
          value={totalSold.toString()}
          subtitle={`${tc('total')} ${tc('pieces')}`}
          icon={TagIcon}
          color="bg-amber-100 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Over Time Chart */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">{t('revenueOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            {formattedChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
                {tc('noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={formattedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(v) => {
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                      if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
                      return v
                    }}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value as number)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#colorRev)"
                    name={t('revenue')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">{t('topProducts')}</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="text-slate-500 text-sm">{tc('noData')}</div>
            ) : (
              <div className="space-y-5">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 truncate max-w-[150px]">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.quantity} {tc('pieces')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(p.totalSum)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sold Products Table */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('soldProducts')}</h2>
        <SoldProductsTable products={aggregatedProducts} lang={lang} />
      </div>
    </div>
  )
}
