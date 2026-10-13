import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCachedDashboardStats } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

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
  const stats = await getCachedDashboardStats(tenantId)

  return <DashboardClient lang={lang} stats={stats} />
}
