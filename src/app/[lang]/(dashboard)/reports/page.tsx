import { getCachedAnalyticsStats, getCachedDashboardStats } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { AnalyticsClient } from '@/components/analytics/analytics-client'
import { ReportsTabs } from '@/components/reports/reports-tabs'
import { PageHeader } from '@/components/shared/page-header'
import { getTranslations } from 'next-intl/server'

interface ReportsPageProps {
  params: Promise<{ lang: string }>
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { lang } = await params
  const t = await getTranslations('analytics')
  const tInfo = await getTranslations('pageInfo')
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
      <PageHeader
        title={t('title')}
        info={tInfo('analytics')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') }
        ]}
      />

      <ReportsTabs
        // `new Date()` on the server, not in the client component: an impure
        // call during render is a React Compiler lint error (see AGENTS.md).
        today={new Date().toISOString().slice(0, 10)}
        overview={
          <AnalyticsClient
            lang={lang}
            stats={stats}
            recentOrders={dashboardStats.recentOrders}
            lowStockRows={dashboardStats.lowStockRows}
          />
        }
      />
    </div>
  )
}
