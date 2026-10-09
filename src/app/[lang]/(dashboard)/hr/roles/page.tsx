import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { RoleTemplatesTable } from '@/components/hr/role-templates-table'
import { getRoleTemplatesPage } from '@/lib/data/queries'
import { readPageParams } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Roles' }

export default async function RoleTemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  const { page, pageSize, search } = readPageParams(sp)
  const tenantId = await getCurrentTenantId() as string
  const [t, rolesPage] = await Promise.all([
    getTranslations('hr'),
    getRoleTemplatesPage(tenantId, { page, pageSize, search }),
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
      <RoleTemplatesTable
        roles={rolesPage.rows}
        lang={lang}
        page={rolesPage.page}
        pageSize={rolesPage.pageSize}
        total={rolesPage.total}
        totalPages={rolesPage.totalPages}
      />
    </div>
  )
}
