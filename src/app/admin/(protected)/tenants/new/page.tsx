import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { TenantForm } from '@/components/admin/tenant-form'
import { getCacheClient } from '@/lib/supabase/cache-client'

export const metadata: Metadata = { title: 'New tenant' }
export const dynamic = 'force-dynamic'

export default async function NewTenantPage() {
  const [t, tTenants] = await Promise.all([
    getTranslations('admin.tenants.new'),
    getTranslations('admin.tenants'),
  ])

  const supabase = getCacheClient() as any
  const { data: supportAgents } = await supabase.from('support_agents').select('id, full_name').order('full_name')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[
          { label: tTenants('title'), href: '/admin/tenants' },
          { label: t('title') },
        ]}
      />

      <TenantForm mode="create" supportAgents={supportAgents ?? []} />
    </div>
  )
}
