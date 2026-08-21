import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { TenantForm } from '@/components/admin/tenant-form'

export const metadata: Metadata = { title: 'New tenant' }

export default async function NewTenantPage() {
  const [t, tTenants] = await Promise.all([
    getTranslations('admin.tenants.new'),
    getTranslations('admin.tenants'),
  ])

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

      <TenantForm mode="create" />
    </div>
  )
}
