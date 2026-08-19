import { getCachedAnalyticsStats, getCachedDashboardStats } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { AnalyticsClient } from '@/components/analytics/analytics-client'
import { PageHeader } from '@/components/shared/page-header'
import { getTranslations } from 'next-intl/server'

interface AnalyticsPageProps {
  params: { lang: string }
}

export default async function AnalyticsPage({ params: { lang } }: AnalyticsPageProps) {
  const t = await getTranslations('analytics')
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
        // description={t('description')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') }
        ]}
      />

      <AnalyticsClient
        lang={lang}
        stats={stats}
        recentOrders={dashboardStats.recentOrders}
        lowStockRows={dashboardStats.lowStockRows}
      />
    </div>
  )
}
