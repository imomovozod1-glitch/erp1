import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { RoleTemplatesTable } from '@/components/hr/role-templates-table'
import { getCachedRoleTemplates } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Roles' }

export default async function RoleTemplatesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const [t, roles] = await Promise.all([
    getTranslations('hr'),
    getCachedRoleTemplates(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('roles')}
        subtitle={t('title')}
        action={{ label: t('addRole'), href: `/${lang}/hr/roles/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('roles') },
        ]}
      />
      <RoleTemplatesTable roles={roles} lang={lang} />
    </div>
  )
}
