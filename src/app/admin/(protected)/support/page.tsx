import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { SupportAgentsTable, type SupportAgentRow } from '@/components/admin/support-agents-table'
import { getCacheClient } from '@/lib/supabase/cache-client'

export const metadata: Metadata = { title: 'Support' }
export const dynamic = 'force-dynamic'

export default async function AdminSupportPage() {
  const t = await getTranslations('admin.support')

  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('support_agents')
    .select('id, full_name, phone, tenants(id, company_name, subdomain)')
    .order('created_at', { ascending: false })

  const agents: SupportAgentRow[] = data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('count', { count: agents.length })} />
      <SupportAgentsTable agents={agents} />
    </div>
  )
}
