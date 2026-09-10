import { getCachedAnalyticsStats, getCachedDashboardStats } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { ReportsTabs } from '@/components/reports/reports-tabs'

interface ReportsPageProps {
  params: Promise<{ lang: string }>
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId()

  // getCachedDashboardStats() shares the same underlying cache entry as the
  // dashboard page, so calling it here too costs nothing extra when both
  // pages are viewed within the cache window — it's just where recentOrders/
  // lowStockRows (moved here from the dashboard) already live.
  const [stats, dashboardStats] = await Promise.all([
    getCachedAnalyticsStats(tenantId as string),
    getCachedDashboardStats(tenantId as string),
  ])

  return (
    <div className="flex flex-col gap-4">
      {/* The page header is rendered by ReportsTabs, not here: the period
          selector and view settings sit on the title row and need its client
          state. */}
      <ReportsTabs
        // `new Date()` on the server, not in the client component: an impure
        // call during render is a React Compiler lint error (see AGENTS.md).
        today={new Date().toISOString().slice(0, 10)}
        lang={lang}
        stats={stats}
        recentOrders={dashboardStats.recentOrders}
        lowStockRows={dashboardStats.lowStockRows}
      />
    </div>
  )
}
