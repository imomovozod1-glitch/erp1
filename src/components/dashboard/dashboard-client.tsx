'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  type LucideIcon,
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
import { formatCurrency, isoDate } from '@/lib/utils'
import { PeriodFilter } from '@/components/shared/period-filter'
import { PageInfoButton } from '@/components/shared/page-info-button'

const formatDateISO = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface DashboardClientProps {
  lang: string
  /** Server-rendered "your support manager" strip; null when none is assigned. */
  agentCard?: React.ReactNode
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


/**
 * One KPI tile.
 *
 * The five below were five copies of the same twenty lines, differing only in
 * label, number, icon and footer — so the decorative corner, the type scale and
 * the hover behaviour all had to be kept in step by hand, and one of them had
 * already drifted.
 */
function KpiTile({
  label,
  value,
  icon: Icon,
  children,
}: {
  label: string
  value: string
  icon: LucideIcon
  /** The small print under the number. */
  children: React.ReactNode
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900">
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-violet-50 opacity-40 transition-transform duration-300 group-hover:scale-110 dark:bg-violet-950/40"
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            {label}
          </span>
          {/* `text-xl`, not 2xl: at five columns a tile leaves roughly 150px
              for the number once the padding and the icon chip are taken, and a
              nine-digit sum in 2xl ran straight out of the card. */}
          <h3 className="text-xl font-bold tracking-tight break-words tabular-nums text-slate-900 dark:text-slate-100">
            {value}
          </h3>
        </div>
        <div className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {children}
    </div>
  )
}

export function DashboardClient({ lang, stats, agentCard }: DashboardClientProps) {
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

  const td = useTranslations('dashboard')
  const tInfo = useTranslations('pageInfo')
  const tSales = useTranslations('sales')
  const tInventory = useTranslations('inventory')
  const tProcurement = useTranslations('procurement')
  const tHr = useTranslations('hr')

  const {
    totalProducts,
    totalCustomers,
    totalEmployees,
    totalSuppliers,
    chartTxData,
    expenseRows,
    lowStockRows,
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
  const todayStr = isoDate(now)
  const oneDayMs = 24 * 60 * 60 * 1000
  const yesterdayStr = isoDate(new Date(now.getTime() - oneDayMs))
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
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.title}
            <PageInfoButton text={tInfo('dashboard')} />
          </h1>
        </div>

        {/* The same preset pills + custom-range popover as the reports and
            transactions screens. This screen used to hand-roll them, which is
            exactly the duplication PeriodFilter exists to prevent — its default
            presets are this list, labelled from the same namespace. */}
        <PeriodFilter
          period={period}
          onPeriodChange={(next) => setPeriod(next as typeof period)}
          customStart={customStart}
          customEnd={customEnd}
          onApplyCustomRange={handleApplyCustomRange}
          lang={lang}
        />
      </div>

      {/* Who to call when something goes wrong, before the numbers. */}
      {agentCard}

      {/* Quick Action Launchpad — every "create new" page in the sidebar, one tap away */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          {t.quickActions}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* One tone for all eight. They were previously indigo / emerald /
              rose / blue / amber / slate at random — a colour per button with
              no meaning behind any of it, which is the single loudest thing on
              the page. These are all just "create something". */}
          {[
            { href: 'sales/orders/new', label: t.newSale, icon: Plus },
            { href: 'finance/cashbox?action=kirim', label: t.addIncome, icon: ArrowUpRight },
            { href: 'finance/cashbox?action=chiqim', label: t.addExpense, icon: ArrowDownRight },
            { href: 'customers/new', label: tSales('addCustomer'), icon: Contact },
            { href: 'inventory/products/new', label: tInventory('addProduct'), icon: Package },
            { href: 'procurement/purchase-orders/new', label: tProcurement('addPurchase'), icon: Truck },
            { href: 'procurement/suppliers/new', label: tProcurement('addSupplier'), icon: Building2 },
            { href: 'hr/employees/new', label: tHr('addEmployee'), icon: UserPlus },
          ].map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={`/${lang}/${action.href}`}
                className="flex min-h-12 items-center justify-start gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-700 dark:hover:bg-violet-950/30 dark:hover:text-violet-300"
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
        <KpiTile label={t.sales} value={formatCurrency(metrics.revenue)} icon={ShoppingCart}>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">{td('ordersCountText', { count: metrics.ordersCount })}</span>
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
              {td('averageCheckText', { amount: formatCurrency(metrics.avgCheck) })}
            </span>
          </div>
        </KpiTile>

        <KpiTile label={t.profit} value={formatCurrency(metrics.profit)} icon={DollarSign}>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
              {td('profitabilityText', {
                percentage: ((metrics.profit / (metrics.revenue || 1)) * 100).toFixed(1),
              })}
            </span>
            <span className="tabular-nums">{td('expenseText', { amount: formatCurrency(metrics.expenses) })}</span>
          </div>
        </KpiTile>

        <KpiTile label={t.cashBalance} value={formatCurrency(realCashboxBalance)} icon={Layers}>
          {/* Money owed to us and money we owe: the one place on this screen
              where colour classifies rather than decorates. */}
          <div className="mt-3 flex items-center justify-between gap-1 border-t pt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex min-w-0 flex-col">
              <span className="text-[9px] font-medium uppercase text-slate-400 dark:text-slate-500">
                {t.receivables}
              </span>
              <span className="mt-0.5 font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(realReceivables)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col text-right">
              <span className="text-[9px] font-medium uppercase text-slate-400 dark:text-slate-500">
                {t.payables}
              </span>
              <span className="mt-0.5 font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {formatCurrency(realPayables)}
              </span>
            </div>
          </div>
        </KpiTile>

        <KpiTile label={t.warehouseValue} value={formatCurrency(realWarehouseValue)} icon={Package}>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">{td('productsCountText', { count: totalProducts ?? 0 })}</span>
            <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {td('lowStockCountText', { count: lowStock.length })}
            </span>
          </div>
        </KpiTile>

        <KpiTile
          label={lang === 'uz' ? 'Qarzga sotilgan' : lang === 'ru' ? 'Продано в долг' : 'Sold on credit'}
          value={formatCurrency(realReceivables)}
          icon={AlertTriangle}
        >
          <div className="mt-3 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span>
              {lang === 'uz'
                ? "Mijozlardan kutilayotgan to'lov"
                : lang === 'ru'
                  ? 'Ожидаемая оплата от клиентов'
                  : 'Expected from customers'}
            </span>
          </div>
        </KpiTile>
      </div>

      {/* Small Secondary Meta info row (Customers & Employees) */}
      {/* Three tiles, three columns — `md:grid-cols-4` left a visible empty
          cell at the end of the row on every desktop width. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{td('customersCountText', { count: totalCustomers ?? 0 })}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{td('employeesCountText', { count: totalEmployees ?? 0 })}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border shadow-sm flex items-center gap-2">
          <Truck className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{td('suppliersCountText', { count: totalSuppliers ?? 0 })}</span>
        </div>
      </div>

    </div>
  )
}
