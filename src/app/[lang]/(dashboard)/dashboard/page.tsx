import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCachedDashboardStats } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { canViewModule } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'nav' })
  return { title: t('dashboard') }
}
export const revalidate = 60

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const [stats, sales, reports, finance, inventory, customers, hr, procurement] = await Promise.all([
    getCachedDashboardStats(tenantId),
    canViewModule('sales'),
    canViewModule('analytics'),
    canViewModule('finance'),
    canViewModule('inventory'),
    canViewModule('customers'),
    canViewModule('hr'),
    canViewModule('procurement'),
  ])

  // The dashboard is open to everyone, its numbers are not: what the user may
  // not see is dropped here, so it never reaches the browser at all.
  const visibleStats = {
    ...stats,
    totalOrders: sales ? stats.totalOrders : null,
    recentOrders: sales ? stats.recentOrders : [],
    pendingInvoices: sales ? stats.pendingInvoices : null,
    totalReceivables: finance || sales ? stats.totalReceivables : 0,
    soldDays: sales || reports
      ? stats.soldDays.map((day) => ({ ...day, cost: reports ? day.cost : 0 }))
      : [],
    chartTxData: finance ? stats.chartTxData : [],
    allTimeExpense: finance ? stats.allTimeExpense : 0,
    totalCashboxBalance: finance ? stats.totalCashboxBalance : 0,
    totalPayables: finance ? stats.totalPayables : 0,
    warehouseValue: inventory ? stats.warehouseValue : 0,
    totalProducts: inventory ? stats.totalProducts : null,
    lowStockRows: inventory ? stats.lowStockRows : [],
    totalCustomers: customers ? stats.totalCustomers : null,
    totalEmployees: hr ? stats.totalEmployees : null,
    totalSuppliers: procurement ? stats.totalSuppliers : null,
  }

  return <DashboardClient lang={lang} stats={visibleStats} />
}
