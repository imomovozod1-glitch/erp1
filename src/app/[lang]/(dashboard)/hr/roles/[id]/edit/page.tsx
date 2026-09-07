import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { RoleTemplateForm } from '@/components/hr/role-template-form'
import type { Metadata } from 'next'
import { getCachedRoleTemplateById } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { notFound } from 'next/navigation'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const tCommon = await getTranslations({ locale: lang, namespace: 'common' })
  return { title: tCommon('edit') }
}

async function fetchRole(id: string, tenantId: string) {
  try {
    return await getCachedRoleTemplateById(id, tenantId)
  } catch {
    return null
  }
}

export default async function EditRoleTemplatePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('hr', lang, '/hr/roles')
  const tenantId = await getCurrentTenantId() as string

  const role = await fetchRole(id, tenantId)
  if (!role) return notFound()

  const [t, tCommon] = await Promise.all([
    getTranslations('hr'),
    getTranslations('common'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={tCommon('edit')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/hr` },
          { label: t('roles'), href: `/${lang}/hr/roles` },
          { label: tCommon('edit') },
        ]}
      />
      <div className="px-4 md:px-8">
        <RoleTemplateForm lang={lang} initialData={role} />
      </div>
    </div>
  )
}
