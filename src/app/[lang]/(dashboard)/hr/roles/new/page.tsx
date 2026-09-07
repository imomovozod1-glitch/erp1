import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { RoleTemplateForm } from '@/components/hr/role-template-form'
import type { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'hr' })
  return { title: t('addRole') }
}

export default async function NewRoleTemplatePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('hr', lang, '/hr/roles')
  const [t, tCommon] = await Promise.all([
    getTranslations('hr'),
    getTranslations('common'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addRole')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/hr` },
          { label: t('roles'), href: `/${lang}/hr/roles` },
          { label: tCommon('add') },
        ]}
      />
      <RoleTemplateForm lang={lang} />
    </div>
  )
}
