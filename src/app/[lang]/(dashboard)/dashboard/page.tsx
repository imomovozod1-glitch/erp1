import type { Metadata } from 'next'
import { getCachedDashboardStats } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { AssignedAgentCard } from '@/components/support/assigned-agent-card'

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
      // Rendered on the server (the tenant side has no RLS access to
      // `support_agents`) and handed to the client shell as a slot.
      agentCard={<AssignedAgentCard tenantId={tenantId} lang={lang} variant="compact" />}
    />
  )
}
