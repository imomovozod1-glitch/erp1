import type { Metadata } from 'next'
import { getCachedDashboardStats } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export const metadata: Metadata = { title: 'Dashboard' }
export const revalidate = 60

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string

  const stats = await getCachedDashboardStats(tenantId)

  return (
    <DashboardClient
      lang={lang}
      stats={stats}
    />
  )
}
