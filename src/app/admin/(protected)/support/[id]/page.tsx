import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { SupportAgentForm } from '@/components/admin/support-agent-form'
import { DeleteSupportAgentButton } from '@/components/admin/delete-support-agent-button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCacheClient } from '@/lib/supabase/cache-client'

export const metadata: Metadata = { title: 'Support agent' }
export const dynamic = 'force-dynamic'

export default async function SupportAgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('admin.support.detail')
  const tSupport = await getTranslations('admin.support')

  const supabase = getCacheClient() as any
  const { data: agent } = await supabase
    .from('support_agents')
    .select('id, full_name, phone, tenants(id, company_name, subdomain)')
    .eq('id', id)
    .maybeSingle()

  if (!agent) return notFound()

  return (
    <div className="space-y-6">
      <PageHeader
        title={agent.full_name}
        breadcrumbs={[
          { label: tSupport('title'), href: '/admin/support' },
          { label: agent.full_name },
        ]}
      />

      <SupportAgentForm mode="edit" initialData={{ id: agent.id, full_name: agent.full_name, phone: agent.phone }} />

      <Card className="border-0 shadow-sm max-w-xl">
        <CardContent className="pt-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('assignedTenants')}</h3>
          {agent.tenants.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{tSupport('noneAssigned')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {agent.tenants.map((tenant: { id: string; company_name: string }) => (
                <Badge key={tenant.id} variant="outline">{tenant.company_name}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteSupportAgentButton agentId={agent.id} />
    </div>
  )
}
