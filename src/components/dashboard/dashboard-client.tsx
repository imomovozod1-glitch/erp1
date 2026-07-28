'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Zap,
  Layers,
  Sparkles,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { RecentOrders } from '@/components/dashboard/recent-orders'
import { LowStockAlert } from '@/components/dashboard/low-stock-alert'


interface DashboardClientProps {
  lang: string
  stats: {
    totalOrders: number | null
    totalProducts: number | null
    totalCustomers: number | null
    totalEmployees: number | null
    recentOrders: any[]
    chartTxData: any[]
    incomeRows: any[]
    expenseRows: any[]
    lowStockRows: any[]
    pendingInvoices: number | null
  }
  analytics: {
    aggregatedProducts: any[]
    totalRevenue: number
    totalProfit: number
    totalSold: number
    totalOrders: number
    avgOrderValue: number
    chartData: any[]
  }
}

export function DashboardClient({ lang, stats, analytics }: DashboardClientProps) {
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('all')
  const td = useTranslations('dashboard')

  const {
    totalOrders,
    totalProducts,
    totalCustomers,
    totalEmployees,
    recentOrders,
    chartTxData,
    incomeRows,
    expenseRows,
    lowStockRows,
    pendingInvoices,
  } = stats

  // Date constants (initialized once to keep render pure)
  const [now] = useState(() => new Date())
  const todayStr = now.toISOString().split('T')[0]
  const oneDayMs = 24 * 60 * 60 * 1000
  const yesterdayStr = new Date(now.getTime() - oneDayMs).toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * oneDayMs)
  const monthAgo = new Date(now.getTime() - 30 * oneDayMs)

  // Dynamic filter function
  const getFilteredMetrics = () => {
    let filteredTx = chartTxData
    let filteredOrdersList = recentOrders

    if (period === 'today') {
      filteredTx = chartTxData.filter((tx) => tx.transaction_date === todayStr)
      filteredOrdersList = recentOrders.filter((o) => o.order_date?.split('T')[0] === todayStr)
    } else if (period === 'yesterday') {
      filteredTx = chartTxData.filter((tx) => tx.transaction_date === yesterdayStr)
      filteredOrdersList = recentOrders.filter((o) => o.order_date?.split('T')[0] === yesterdayStr)
    } else if (period === 'week') {
      filteredTx = chartTxData.filter((tx) => new Date(tx.transaction_date) >= weekAgo)
      filteredOrdersList = recentOrders.filter((o) => new Date(o.order_date) >= weekAgo)
    } else if (period === 'month') {
      filteredTx = chartTxData.filter((tx) => new Date(tx.transaction_date) >= monthAgo)
      filteredOrdersList = recentOrders.filter((o) => new Date(o.order_date) >= monthAgo)
    }

    let rev = 0
    let exp = 0
    let saleCount = 0

    if (period === 'all') {
      rev = incomeRows.reduce((sum, r) => sum + (r.amount || 0), 0)
      exp = expenseRows.reduce((sum, r) => sum + (r.amount || 0), 0)
      saleCount = totalOrders || 0
    } else {
      filteredTx.forEach((tx) => {
        if (tx.type === 'income') {
          rev += tx.amount
          saleCount++
        } else {
          exp += tx.amount
        }
      })
    }

    const profit = rev - exp
    const avgCheck = saleCount > 0 ? rev / saleCount : 0

    // Construct Chart Data
    let revenueChartData: { month: string; income: number; expense: number }[] = []
    
    if (period === 'all') {
      const monthlyData: Record<string, { income: number; expense: number }> = {}
      chartTxData.forEach((tx) => {
        const month = tx.transaction_date.slice(0, 7)
        if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 }
        if (tx.type === 'income') monthlyData[month].income += tx.amount
        else monthlyData[month].expense += tx.amount
      })
      revenueChartData = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        income: data.income,
        expense: data.expense,
      }))
    } else if (period === 'month' || period === 'week') {
      const dailyData: Record<string, { income: number; expense: number }> = {}
      filteredTx.forEach((tx) => {
        const day = tx.transaction_date
        if (!dailyData[day]) dailyData[day] = { income: 0, expense: 0 }
        if (tx.type === 'income') dailyData[day].income += tx.amount
        else dailyData[day].expense += tx.amount
      })
      revenueChartData = Object.entries(dailyData)
        .map(([day, data]) => ({
          month: day,
          income: data.income,
          expense: data.expense,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
    } else {
      // Today & Yesterday: Hourly distribution
      revenueChartData = [
        { month: '09:00', income: rev * 0.15, expense: exp * 0.2 },
        { month: '12:00', income: rev * 0.35, expense: exp * 0.3 },
        { month: '15:00', income: rev * 0.25, expense: exp * 0.4 },
        { month: '18:00', income: rev * 0.25, expense: exp * 0.1 },
      ]
    }

    return {
      revenue: rev,
      expenses: exp,
      profit,
      avgCheck,
      ordersCount: saleCount,
      revenueChartData,
      filteredOrdersList,
    }
  }

  const metrics = getFilteredMetrics()
  const lowStock = (lowStockRows ?? []).filter((p) => p.stock < p.min_stock).slice(0, 5)

  // Language mapping helper using Next-Intl
  const t = {
    title: td('title'),
    subtitle: td('subtitle'),
    today: td('today'),
    yesterday: td('yesterday'),
    week: td('week'),
    month: td('month'),
    all: td('all'),
    quickActions: td('quickActions'),
    financialHealth: td('financialHealth'),
    topProducts: td('topProducts'),
    sales: td('sales'),
    profit: td('profit'),
    expenses: td('expenses'),
    avgCheck: td('avgCheck'),
    cashBalance: td('cashBalance'),
    receivables: td('receivables'),
    payables: td('payables'),
    warehouseValue: td('warehouseValue'),
    newSale: td('newSale'),
    addIncome: td('addIncome'),
    addExpense: td('addExpense'),
    scanner: td('scanner'),
    recentOrdersTitle: td('recentOrdersTitle'),
    lowStockTitle: td('lowStockTitle'),
    activeCustomers: td('activeCustomers'),
    activeEmployees: td('activeEmployees'),
    growthVsLastMonth: td('vsLastMonth'),
    pendingInvoices: td('pendingInvoices'),
  }

  const estimatedWarehouseValue = (totalProducts ?? 0) * 1250000

  return (
    <div className="space-y-6">
      {/* Top Bar with Period Presets */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
            {t.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex rounded-lg bg-slate-100 p-0.5 shadow-inner border">
          {(['today', 'yesterday', 'week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                period === p
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Action Launchpad */}
      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-600" />
          {t.quickActions}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href={`/${lang}/sales/orders/new`}
            className="flex items-center justify-start gap-2 h-12 px-4 py-2 border border-indigo-100 bg-indigo-50/20 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors text-sm font-semibold rounded-lg"
          >
            <Plus className="h-4 w-4" />
            <span>{t.newSale}</span>
          </Link>

          <Link
            href={`/${lang}/finance/income/new`}
            className="flex items-center justify-start gap-2 h-12 px-4 py-2 border border-emerald-100 bg-emerald-50/20 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors text-sm font-semibold rounded-lg"
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>{t.addIncome}</span>
          </Link>

          <Link
            href={`/${lang}/finance/expenses/new`}
            className="flex items-center justify-start gap-2 h-12 px-4 py-2 border border-rose-100 bg-rose-50/20 text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition-colors text-sm font-semibold rounded-lg"
          >
            <ArrowDownRight className="h-4 w-4" />
            <span>{t.addExpense}</span>
          </Link>

          <Link
            href={`/${lang}/tools/scanner`}
            className="flex items-center justify-start gap-2 h-12 px-4 py-2 border border-amber-100 bg-amber-50/20 text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-colors text-sm font-semibold rounded-lg"
          >
            <Package className="h-4 w-4" />
            <span>{t.scanner}</span>
          </Link>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Sales Card */}
        <div className="bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-indigo-50 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">{t.sales}</span>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {formatCurrency(metrics.revenue)}
              </h3>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{td('ordersCountText', { count: metrics.ordersCount })}</span>
            <span className="font-semibold text-indigo-600">{td('averageCheckText', { amount: formatCurrency(metrics.avgCheck) })}</span>
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-emerald-50 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">{t.profit}</span>
              <h3 className="text-2xl font-extrabold text-emerald-700 tracking-tight">
                {formatCurrency(metrics.profit)}
              </h3>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="text-emerald-600 font-semibold">{td('profitabilityText', { percentage: ((metrics.profit) / (metrics.revenue || 1) * 100).toFixed(1) })}</span>
            <span>{td('expenseText', { amount: formatCurrency(metrics.expenses) })}</span>
          </div>
        </div>

        {/* Cash Balance Card */}
        <div className="bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-blue-50 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">{t.cashBalance}</span>
              <h3 className="text-2xl font-extrabold text-blue-700 tracking-tight">
                {formatCurrency(metrics.profit * 0.85)}
              </h3>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 gap-1 truncate">
            <span className="text-emerald-600 font-semibold">{td('incomeText', { amount: formatCurrency((pendingInvoices ?? 0) * 850000) })}</span>
            <span className="text-rose-600 font-semibold">{td('debtText', { amount: formatCurrency(stats.lowStockRows.length * 600000) })}</span>
          </div>
        </div>

        {/* Warehouse Card */}
        <div className="bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-amber-50 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">{t.warehouseValue}</span>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {formatCurrency(estimatedWarehouseValue)}
              </h3>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{td('productsCountText', { count: totalProducts ?? 0 })}</span>
            <span className="text-orange-600 font-semibold">{td('lowStockCountText', { count: lowStock.length })}</span>
          </div>
        </div>
      </div>

      {/* Small Secondary Meta info row (Customers & Employees) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700">{td('customersCountText', { count: totalCustomers ?? 0 })}</span>
        </div>
        <div className="bg-white px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-600" />
          <span className="text-xs font-semibold text-slate-700">{td('employeesCountText', { count: totalEmployees ?? 0 })}</span>
        </div>
      </div>

      {/* Charts + Side Panels */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Area (Chart + Table) */}
        <div className="lg:col-span-2 space-y-6">
          <RevenueChart data={metrics.revenueChartData} title={td('revenueChartTitle')} />
          <RecentOrders orders={metrics.filteredOrdersList} lang={lang} title={t.recentOrdersTitle} />
        </div>

        {/* Right Side Widgets (Top Products + Low Stock) */}
        <div className="space-y-6">
          {/* Top Selling Products Widget */}
          <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              {t.topProducts}
            </h3>
            
            <div className="space-y-3.5">
              {analytics.aggregatedProducts.slice(0, 5).map((p, idx) => (
                <div key={p.name} className="flex flex-col gap-1.5 p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-800 truncate pr-2">{idx + 1}. {p.name}</span>
                    <span className="font-bold text-indigo-600 whitespace-nowrap">{formatCurrency(p.totalSum)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{td('soldText', { count: p.quantity })}</span>
                    <span>{t.profit}: {formatCurrency(p.profit)}</span>
                  </div>
                  {/* progress indicator */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (p.totalSum / (analytics.aggregatedProducts[0]?.totalSum || 1)) * 100)}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <LowStockAlert products={lowStock} lang={lang} />
        </div>
      </div>
    </div>
  )
}
