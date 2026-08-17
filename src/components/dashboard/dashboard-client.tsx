'use client'

import { useState, useEffect } from 'react'
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
  Truck,
  AlertTriangle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { RecentOrders } from '@/components/dashboard/recent-orders'
import { LowStockAlert } from '@/components/dashboard/low-stock-alert'
import { AnalyticsStats } from '@/components/analytics/analytics-stats'
import { AnalyticsCharts } from '@/components/analytics/analytics-charts'
import { SoldProductsTable } from '@/components/analytics/sold-products-table'
import { CustomDateRangePicker } from '@/components/shared/custom-date-range-picker'

const formatDateISO = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface DashboardClientProps {
  lang: string
  stats: {
    totalOrders: number | null
    totalProducts: number | null
    totalCustomers: number | null
    totalEmployees: number | null
    totalSuppliers: number | null
    recentOrders: any[]
    chartTxData: any[]
    incomeRows: any[]
    expenseRows: any[]
    lowStockRows: any[]
    pendingInvoices: number | null
    totalCashboxBalance?: number
    warehouseValue?: number
    totalReceivables?: number
    totalPayables?: number
    soldItems?: { order_date: string; revenue: number; cost: number }[]
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
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('dashboard_period')
      if (saved === 'today' || saved === 'yesterday' || saved === 'week' || saved === 'month' || saved === 'all' || saved === 'custom') {
        return saved
      }
    }
    return 'all'
  })

  const [customStart, setCustomStart] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('dashboard_custom_start')
      if (saved) return saved
    }
    return formatDateISO(new Date()) + 'T00:00'
  })
  const [customEnd, setCustomEnd] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('dashboard_custom_end')
      if (saved) return saved
    }
    return formatDateISO(new Date()) + 'T23:59'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dashboard_period', period)
      sessionStorage.setItem('dashboard_custom_start', customStart)
      sessionStorage.setItem('dashboard_custom_end', customEnd)
    }
  }, [period, customStart, customEnd])

  const handleApplyCustomRange = (start: string, end: string) => {
    setCustomStart(start)
    setCustomEnd(end)
    setPeriod('custom')
  }

  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  
  useEffect(() => {
    const timeoutId = setTimeout(() => setCurrentTime(new Date()), 0)
    const timerId = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => {
      clearTimeout(timeoutId)
      clearInterval(timerId)
    }
  }, [])

  const td = useTranslations('dashboard')

  const {
    totalOrders,
    totalProducts,
    totalCustomers,
    totalEmployees,
    totalSuppliers,
    recentOrders,
    chartTxData,
    incomeRows,
    expenseRows,
    lowStockRows,
    pendingInvoices,
    totalCashboxBalance = 0,
    warehouseValue = 0,
    totalReceivables = 0,
    totalPayables = 0,
    soldItems = [],
  } = stats

  const [realCashboxBalance, setRealCashboxBalance] = useState(totalCashboxBalance)
  const [realWarehouseValue, setRealWarehouseValue] = useState(warehouseValue)
  const [realReceivables, setRealReceivables] = useState(totalReceivables)
  const [realPayables, setRealPayables] = useState(totalPayables)

  useEffect(() => {
    // Avoid calling setState synchronously within the effect body
    const timer = setTimeout(() => {
      // If local storage contains data, we update balances to make them accurate for demo/local fallback too!
      const localCash = localStorage.getItem('erp_cashboxes')
      if (localCash) {
        try {
          const parsed = JSON.parse(localCash)
          const sum = parsed.reduce((acc: number, c: any) => acc + (Number(c.balance) || 0), 0)
          setRealCashboxBalance(sum)
        } catch (e) {
          console.error(e)
        }
      } else {
        setRealCashboxBalance(totalCashboxBalance)
      }

      const localInv = localStorage.getItem('erp_invoices')
      if (localInv) {
        try {
          const parsed = JSON.parse(localInv)
          const unpaid = parsed.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled')
          const sum = unpaid.reduce((acc: number, i: any) => acc + ((Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0)), 0)
          setRealReceivables(sum)
        } catch (e) {
          console.error(e)
        }
      } else {
        setRealReceivables(totalReceivables)
      }

      const localProd = localStorage.getItem('erp_products')
      if (localProd) {
        try {
          const parsed = JSON.parse(localProd)
          const sum = parsed.reduce((acc: number, p: any) => acc + ((Number(p.stock) || 0) * (Number(p.cost_price) || 0)), 0)
          setRealWarehouseValue(sum)
        } catch (e) {
          console.error(e)
        }
      } else {
        setRealWarehouseValue(warehouseValue)
      }

      const localPo = localStorage.getItem('erp_purchase_orders')
      if (localPo) {
        try {
          const parsedPo = JSON.parse(localPo)
          const nonCancelled = parsedPo.filter((po: any) => po.status !== 'cancelled')
          const purchasesSum = nonCancelled.reduce((acc: number, po: any) => acc + (Number(po.total_amount) || 0), 0)

          let paymentsSum = 0
          const localTx = localStorage.getItem('erp_transactions')
          if (localTx) {
            try {
              const parsedTx = JSON.parse(localTx)
              paymentsSum = parsedTx
                .filter((tx: any) => tx.type === 'expense' && tx.supplier_id)
                .reduce((acc: number, tx: any) => acc + (Number(tx.amount) || 0), 0)
            } catch (e) {
              console.error(e)
            }
          }

          setRealPayables(purchasesSum - paymentsSum)
        } catch (e) {
          console.error(e)
        }
      } else {
        setRealPayables(totalPayables)
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [totalCashboxBalance, totalReceivables, warehouseValue, totalPayables])

  // Date constants (initialized once to keep render pure)
  const [now] = useState(() => new Date())
  const todayStr = now.toISOString().split('T')[0]
  const oneDayMs = 24 * 60 * 60 * 1000
  const yesterdayStr = new Date(now.getTime() - oneDayMs).toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * oneDayMs)
  const monthAgo = new Date(now.getTime() - 30 * oneDayMs)

  // Custom range bounds (only meaningful when period === 'custom')
  const customStartDate = customStart ? new Date(customStart) : null
  const customEndDate = customEnd ? new Date(customEnd) : null

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
    } else if (period === 'custom') {
      filteredTx = chartTxData.filter((tx) => {
        const d = new Date(tx.transaction_date)
        return (!customStartDate || d >= customStartDate) && (!customEndDate || d <= customEndDate)
      })
      filteredOrdersList = recentOrders.filter((o) => {
        if (!o.order_date) return false
        const d = new Date(o.order_date)
        return (!customStartDate || d >= customStartDate) && (!customEndDate || d <= customEndDate)
      })
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

    // Profit = total sales revenue - cost price (COGS) of sold goods, filtered to the same period
    let filteredSoldItems = soldItems
    if (period === 'today') {
      filteredSoldItems = soldItems.filter((si) => si.order_date?.split('T')[0] === todayStr)
    } else if (period === 'yesterday') {
      filteredSoldItems = soldItems.filter((si) => si.order_date?.split('T')[0] === yesterdayStr)
    } else if (period === 'week') {
      filteredSoldItems = soldItems.filter((si) => new Date(si.order_date) >= weekAgo)
    } else if (period === 'month') {
      filteredSoldItems = soldItems.filter((si) => new Date(si.order_date) >= monthAgo)
    } else if (period === 'custom') {
      filteredSoldItems = soldItems.filter((si) => {
        if (!si.order_date) return false
        const d = new Date(si.order_date)
        return (!customStartDate || d >= customStartDate) && (!customEndDate || d <= customEndDate)
      })
    }
    const salesRevenue = filteredSoldItems.reduce((sum, si) => sum + si.revenue, 0)
    const costOfGoods = filteredSoldItems.reduce((sum, si) => sum + si.cost, 0)
    const profit = salesRevenue - costOfGoods
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
    } else if (period === 'month' || period === 'week' || period === 'custom') {
      // Transactions only carry a date (no time), so custom ranges get the same
      // daily granularity as week/month rather than an hourly breakdown.
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
    // scanner: td('scanner'),
    recentOrdersTitle: td('recentOrdersTitle'),
    lowStockTitle: td('lowStockTitle'),
    activeCustomers: td('activeCustomers'),
    activeEmployees: td('activeEmployees'),
    growthVsLastMonth: td('vsLastMonth'),
    pendingInvoices: td('pendingInvoices'),
  }

  return (
    <div className="space-y-6">
      {/* Top Bar with Period Presets */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {/* <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" /> */}
            {t.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {/* {t.subtitle} */}
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
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

          <CustomDateRangePicker
            isActive={period === 'custom'}
            start={customStart}
            end={customEnd}
            onApply={handleApplyCustomRange}
          />
        </div>
      </div>

      {/* Quick Action Launchpad */}
      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-600" />
          {/* {t.quickActions} */}
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
            href={`/${lang}/finance/transactions/new?type=income`}
            className="flex items-center justify-start gap-2 h-12 px-4 py-2 border border-emerald-100 bg-emerald-50/20 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors text-sm font-semibold rounded-lg"
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>{t.addIncome}</span>
          </Link>

          <Link
            href={`/${lang}/finance/transactions/new?type=expense`}
            className="flex items-center justify-start gap-2 h-12 px-4 py-2 border border-rose-100 bg-rose-50/20 text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition-colors text-sm font-semibold rounded-lg"
          >
            <ArrowDownRight className="h-4 w-4" />
            <span>{t.addExpense}</span>
          </Link>

          {/* <Link
            href={`/${lang}/tools/scanner`}
            className="flex items-center justify-start gap-2 h-12 px-4 py-2 border border-amber-100 bg-amber-50/20 text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-colors text-sm font-semibold rounded-lg"
          >
            <Package className="h-4 w-4" />
            <span>{t.scanner}</span>
          </Link> */}
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
                {formatCurrency(realCashboxBalance)}
              </h3>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 gap-1 border-t pt-2 mt-2">
            <div className="flex flex-col">
              <span className="text-slate-400 font-medium text-[9px] uppercase">{t.receivables}</span>
              <span className="font-bold text-emerald-600 mt-0.5">{formatCurrency(realReceivables)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-slate-400 font-medium text-[9px] uppercase">{t.payables}</span>
              <span className="font-bold text-rose-600 mt-0.5">{formatCurrency(realPayables)}</span>
            </div>
          </div>
        </div>

        {/* Warehouse Card */}
        <div className="bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-amber-50 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">{t.warehouseValue}</span>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {formatCurrency(realWarehouseValue)}
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

        {/* Sold on Credit (Customer Debt) Card */}
        <div className="bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-amber-50 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">{lang === 'uz' ? 'Qarzga sotilgan' : lang === 'ru' ? 'Продано в долг' : 'Sold on credit'}</span>
              <h3 className="text-2xl font-extrabold text-amber-700 tracking-tight">
                {formatCurrency(realReceivables)}
              </h3>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-xs text-slate-500">
            <span>{lang === 'uz' ? "Mijozlardan kutilayotgan to'lov" : lang === 'ru' ? 'Ожидаемая оплата от клиентов' : 'Expected from customers'}</span>
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
        <div className="bg-white px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-2">
          <Truck className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold text-slate-700">{td('suppliersCountText', { count: totalSuppliers ?? 0 })}</span>
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

      {/* Analytics Section Integrated */}
      <div className="pt-8 mt-8 border-t space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
              {td('analyticsTitle', { fallback: 'Analitika' })}
            </h2>
          </div>

        </div>

        <AnalyticsStats
          totalRevenue={analytics.totalRevenue}
          totalProfit={analytics.totalProfit}
          totalSold={analytics.totalSold}
          totalOrders={analytics.totalOrders}
          avgOrderValue={analytics.avgOrderValue}
        />

        <AnalyticsCharts
          chartData={analytics.chartData}
          topProducts={analytics.aggregatedProducts.slice(0, 7)}
        />

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">{td('soldProducts', { fallback: 'Sotilgan maxsulotlar' })}</h2>
          <SoldProductsTable products={analytics.aggregatedProducts} lang={lang} />
        </div>
      </div>
    </div>
  )
}
