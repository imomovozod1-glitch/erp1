import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { SupportAgentForm } from '@/components/admin/support-agent-form'

export const metadata: Metadata = { title: 'New support agent' }

export default async function NewSupportAgentPage() {
  const [t, tSupport] = await Promise.all([
    getTranslations('admin.support.new'),
    getTranslations('admin.support'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[
          { label: tSupport('title'), href: '/admin/support' },
          { label: t('title') },
        ]}
      />
      <SupportAgentForm mode="create" />
    </div>
  )
}
