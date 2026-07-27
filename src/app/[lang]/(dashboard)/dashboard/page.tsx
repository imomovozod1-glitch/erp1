import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { StatsCard } from '@/components/shared/stats-card'
import { PageHeader } from '@/components/shared/page-header'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { RecentOrders } from '@/components/dashboard/recent-orders'
import { LowStockAlert } from '@/components/dashboard/low-stock-alert'
import { formatCurrency } from '@/lib/utils'
import { getCachedDashboardStats } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'Dashboard' }
export const revalidate = 60

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  const [t, stats] = await Promise.all([
    getTranslations('dashboard'),
    getCachedDashboardStats(),
  ])

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



  const lowStock = ((lowStockRows ?? []) as { id: string; name: string; sku: string; stock: number; min_stock: number }[])
    .filter((p) => p.stock < p.min_stock)
    .slice(0, 5)

  const totalRevenue = ((incomeRows ?? []) as { amount: number }[]).reduce((sum, row) => sum + (row.amount || 0), 0)
  const totalExpenses = ((expenseRows ?? []) as { amount: number }[]).reduce((sum, row) => sum + (row.amount || 0), 0)


  // Group chart data by month
  const monthlyData: Record<string, { income: number; expense: number }> = {}
  const chartRows = ((chartTxData ?? []) as { amount: number; type: string; transaction_date: string }[])
  chartRows.forEach((tx) => {
    const month = tx.transaction_date.slice(0, 7)
    if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 }
    if (tx.type === 'income') monthlyData[month].income += tx.amount
    else monthlyData[month].expense += tx.amount
  })
  const revenueChartData = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    income: data.income,
    expense: data.expense,
  }))

  // lowStock already computed above

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />

      {/* KPI Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('totalRevenue')}
          value={formatCurrency(totalRevenue)}
          icon={DollarSign}
          trend={{ value: 12.5, label: t('vsLastMonth') }}
          iconClassName="bg-emerald-500"
        />
        <StatsCard
          title={t('totalExpenses')}
          value={formatCurrency(totalExpenses)}
          icon={TrendingUp}
          trend={{ value: -3.2, label: t('vsLastMonth') }}
          iconClassName="bg-red-500"
        />
        <StatsCard
          title={t('totalOrders')}
          value={totalOrders ?? 0}
          icon={ShoppingCart}
          trend={{ value: 8.1, label: t('vsLastMonth') }}
          iconClassName="bg-blue-500"
        />
        <StatsCard
          title={t('totalProducts')}
          value={totalProducts ?? 0}
          icon={Package}
          iconClassName="bg-purple-500"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('totalCustomers')}
          value={totalCustomers ?? 0}
          icon={Users}
          trend={{ value: 5.4, label: t('vsLastMonth') }}
          iconClassName="bg-amber-500"
        />
        <StatsCard
          title={t('totalEmployees')}
          value={totalEmployees ?? 0}
          icon={Users}
          iconClassName="bg-slate-500"
        />
        <StatsCard
          title={t('lowStock')}
          value={lowStock.length}
          icon={AlertTriangle}
          iconClassName="bg-orange-500"
        />
        <StatsCard
          title={t('pendingInvoices')}
          value={pendingInvoices ?? 0}
          icon={FileText}
          iconClassName="bg-indigo-500"
        />
      </div>

      {/* Charts + Tables */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={revenueChartData} title={t('revenueChart')} />
        </div>
        <div>
          <LowStockAlert products={lowStock} lang={lang} />
        </div>
      </div>

      <div>
        <RecentOrders orders={recentOrders ?? []} lang={lang} title={t('recentOrders')} />
      </div>
    </div>
  )
}
