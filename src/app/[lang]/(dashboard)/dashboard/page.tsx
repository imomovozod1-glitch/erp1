import type { Metadata } from 'next'
import { getCachedDashboardStats, getCachedAnalyticsStats } from '@/lib/data/queries'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export const metadata: Metadata = { title: 'Dashboard' }
export const revalidate = 60

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  const [stats, analytics] = await Promise.all([
    getCachedDashboardStats(),
    getCachedAnalyticsStats(),
  ])

  return (
    <DashboardClient
      lang={lang}
      stats={stats}
      analytics={analytics}
    />
  )
}
