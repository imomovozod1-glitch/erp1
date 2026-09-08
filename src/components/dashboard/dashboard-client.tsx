'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Zap,
  Layers,
  Truck,
  AlertTriangle,
  Contact,
  Building2,
  UserPlus,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CustomDateRangePicker } from '@/components/shared/custom-date-range-picker'
import { PageInfoButton } from '@/components/shared/page-info-button'

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
    soldItems?: { order_id: string; order_date: string; revenue: number; cost: number }[]
  }
}

export function DashboardClient({ lang, stats }: DashboardClientProps) {
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
  const tInfo = useTranslations('pageInfo')
  const tSales = useTranslations('sales')
  const tInventory = useTranslations('inventory')
  const tProcurement = useTranslations('procurement')
  const tFinance = useTranslations('finance')
  const tHr = useTranslations('hr')

  const {
    totalProducts,
    totalCustomers,
    totalEmployees,
    totalSuppliers,
    chartTxData,
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

    if (period === 'today') {
      filteredTx = chartTxData.filter((tx) => tx.transaction_date === todayStr)
    } else if (period === 'yesterday') {
      filteredTx = chartTxData.filter((tx) => tx.transaction_date === yesterdayStr)
    } else if (period === 'week') {
      filteredTx = chartTxData.filter((tx) => new Date(tx.transaction_date) >= weekAgo)
    } else if (period === 'month') {
      filteredTx = chartTxData.filter((tx) => new Date(tx.transaction_date) >= monthAgo)
    } else if (period === 'custom') {
      filteredTx = chartTxData.filter((tx) => {
        const d = new Date(tx.transaction_date)
        return (!customStartDate || d >= customStartDate) && (!customEndDate || d <= customEndDate)
      })
    }

    let exp = 0

    if (period === 'all') {
      exp = expenseRows.reduce((sum, r) => sum + (r.amount || 0), 0)
    } else {
      filteredTx.forEach((tx) => {
        if (tx.type === 'expense') exp += tx.amount
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
    // "Total sales" is the sum of what was actually sold (sales_order_items), NOT the
    // sum of `income` transactions — the latter also contains manual cashbox top-ups,
    // customer debt repayments and other non-sale income.
    const salesRevenue = filteredSoldItems.reduce((sum, si) => sum + si.revenue, 0)
    const costOfGoods = filteredSoldItems.reduce((sum, si) => sum + si.cost, 0)
    const profit = salesRevenue - costOfGoods
    // Line items belong to orders, so the order count is the number of distinct orders.
    const saleCount = new Set(filteredSoldItems.map((si) => si.order_id).filter(Boolean)).size
    const avgCheck = saleCount > 0 ? salesRevenue / saleCount : 0

    return {
      revenue: salesRevenue,
      expenses: exp,
      profit,
      avgCheck,
      ordersCount: saleCount,
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
    lowStockTitle: td('lowStockTitle'),
    activeCustomers: td('activeCustomers'),
    activeEmployees: td('activeEmployees'),
    growthVsLastMonth: td('vsLastMonth'),
    pendingInvoices: td('pendingInvoices'),
  }

  return (
    <div className="space-y-6">
      {/* Top Bar with Period Presets */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            {/* <Sparkles className="h-5 w-5 text-violet-600 animate-pulse" /> */}
            {t.title}
            <PageInfoButton text={tInfo('dashboard')} />
          </h1>
          <p className="text-xs text-muted-foreground">
            {/* {t.subtitle} */}
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 shadow-inner border">
            {(['today', 'yesterday', 'week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  period === p
                    ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
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

      {/* Quick Action Launchpad — every "create new" page in the sidebar, one tap away */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          {t.quickActions}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: 'sales/orders/new', label: t.newSale, icon: Plus, tone: 'indigo' },
            { href: 'finance/cashbox?action=kirim', label: t.addIncome, icon: ArrowUpRight, tone: 'emerald' },
            { href: 'finance/cashbox?action=chiqim', label: t.addExpense, icon: ArrowDownRight, tone: 'rose' },
            { href: 'customers/new', label: tSales('addCustomer'), icon: Contact, tone: 'slate' },
            // { href: 'customers/categories/new', label: tSales('addCustomerCategory'), icon: FolderPlus, tone: 'blue' },
            { href: 'inventory/products/new', label: tInventory('addProduct'), icon: Package, tone: 'amber' },
            // { href: 'inventory/categories/new', label: tInventory('addCategory'), icon: Tag, tone: 'amber' },
            { href: 'procurement/purchase-orders/new', label: tProcurement('addPurchase'), icon: Truck, tone: 'indigo' },
            { href: 'procurement/suppliers/new', label: tProcurement('addSupplier'), icon: Building2, tone: 'blue' },
            // { href: 'finance/categories/new', label: tFinance('addTxCategory'), icon: FolderPlus, tone: 'slate' },
            { href: 'hr/employees/new', label: tHr('addEmployee'), icon: UserPlus, tone: 'emerald' },
          ].map((action) => {
            const Icon = action.icon
            const toneClasses: Record<string, string> = {
              indigo: 'border-violet-100 dark:border-violet-900/50 bg-violet-50/20 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-800 dark:hover:text-violet-300',
              emerald: 'border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-800 dark:hover:text-emerald-300',
              rose: 'border-rose-100 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-800 dark:hover:text-rose-300',
              blue: 'border-blue-100 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-800 dark:hover:text-blue-300',
              amber: 'border-amber-100 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-800 dark:hover:text-amber-300',
              slate: 'border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100',
            }
            return (
              <Link
                key={action.href}
                href={`/${lang}/${action.href}`}
                className={`flex items-center justify-start gap-2 min-h-12 px-4 py-2.5 border transition-colors text-sm font-semibold rounded-lg ${toneClasses[action.tone]}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="leading-tight">{action.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Sales Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-violet-50 dark:bg-violet-950/40 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{t.sales}</span>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {formatCurrency(metrics.revenue)}
              </h3>
            </div>
            <div className="p-2 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-lg">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{td('ordersCountText', { count: metrics.ordersCount })}</span>
            <span className="font-semibold text-violet-600 dark:text-violet-400">{td('averageCheckText', { amount: formatCurrency(metrics.avgCheck) })}</span>
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-emerald-50 dark:bg-emerald-950/40 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{t.profit}</span>
              <h3 className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight">
                {formatCurrency(metrics.profit)}
              </h3>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{td('profitabilityText', { percentage: ((metrics.profit) / (metrics.revenue || 1) * 100).toFixed(1) })}</span>
            <span>{td('expenseText', { amount: formatCurrency(metrics.expenses) })}</span>
          </div>
        </div>

        {/* Cash Balance Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-blue-50 dark:bg-blue-950/40 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{t.cashBalance}</span>
              <h3 className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 tracking-tight">
                {formatCurrency(realCashboxBalance)}
              </h3>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-1 border-t pt-2 mt-2">
            <div className="flex flex-col">
              <span className="text-slate-400 dark:text-slate-500 font-medium text-[9px] uppercase">{t.receivables}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(realReceivables)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-slate-400 dark:text-slate-500 font-medium text-[9px] uppercase">{t.payables}</span>
              <span className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">{formatCurrency(realPayables)}</span>
            </div>
          </div>
        </div>

        {/* Warehouse Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-amber-50 dark:bg-amber-950/40 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{t.warehouseValue}</span>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {formatCurrency(realWarehouseValue)}
              </h3>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-lg">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{td('productsCountText', { count: totalProducts ?? 0 })}</span>
            <span className="text-orange-600 dark:text-orange-400 font-semibold">{td('lowStockCountText', { count: lowStock.length })}</span>
          </div>
        </div>

        {/* Sold on Credit (Customer Debt) Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-amber-50 dark:bg-amber-950/40 opacity-40 group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">{lang === 'uz' ? 'Qarzga sotilgan' : lang === 'ru' ? 'Продано в долг' : 'Sold on credit'}</span>
              <h3 className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tracking-tight">
                {formatCurrency(realReceivables)}
              </h3>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span>{lang === 'uz' ? "Mijozlardan kutilayotgan to'lov" : lang === 'ru' ? 'Ожидаемая оплата от клиентов' : 'Expected from customers'}</span>
          </div>
        </div>
      </div>

      {/* Small Secondary Meta info row (Customers & Employees) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{td('customersCountText', { count: totalCustomers ?? 0 })}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{td('employeesCountText', { count: totalEmployees ?? 0 })}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-2">
          <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{td('suppliersCountText', { count: totalSuppliers ?? 0 })}</span>
        </div>
      </div>

    </div>
  )
}
