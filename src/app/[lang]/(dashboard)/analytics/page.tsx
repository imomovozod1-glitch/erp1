import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { AnalyticsStats } from '@/components/analytics/analytics-stats'
import { AnalyticsCharts } from '@/components/analytics/analytics-charts'
import { SoldProductsTable } from '@/components/analytics/sold-products-table'
import { getCachedAnalyticsStats } from '@/lib/data/queries'

export const revalidate = 60

export const metadata: Metadata = { title: 'Analytics' }

export default async function AnalyticsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, stats] = await Promise.all([
    getTranslations('analytics'),
    getCachedAnalyticsStats(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <AnalyticsStats
        totalRevenue={stats.totalRevenue}
        totalProfit={stats.totalProfit}
        totalSold={stats.totalSold}
        totalOrders={stats.totalOrders}
        avgOrderValue={stats.avgOrderValue}
      />

      <AnalyticsCharts
        chartData={stats.chartData}
        topProducts={stats.aggregatedProducts.slice(0, 7)}
      />

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('soldProducts')}</h2>
        <SoldProductsTable products={stats.aggregatedProducts} />
      </div>
    </div>
  )
}
