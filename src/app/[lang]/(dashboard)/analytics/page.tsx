import { getCachedAnalyticsStats } from '@/lib/data/queries'
import { AnalyticsClient } from '@/components/analytics/analytics-client'
import { PageHeader } from '@/components/shared/page-header'
import { getTranslations } from 'next-intl/server'

interface AnalyticsPageProps {
  params: { lang: string }
}

export default async function AnalyticsPage({ params: { lang } }: AnalyticsPageProps) {
  const t = await getTranslations('analytics')
  
  // We fetch the stats server-side
  const stats = await getCachedAnalyticsStats()

  return (
    <div className="flex flex-col gap-4 p-4 md:p-8 pt-6">
      <PageHeader
        title={t('title')}
        // description={t('description')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') }
        ]}
      />

      <AnalyticsClient lang={lang} stats={stats} />
    </div>
  )
}
