import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { ServiceForm } from '@/components/inventory/service-form'
import { Metadata } from 'next'
import { getCachedCategoriesForSelect, getAssignableUsers, getCachedProductFormOptions } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireModuleEdit } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('addService') }
}

export default async function NewServicePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('inventory', lang, '/inventory/services')
  const tenantId = await getCurrentTenantId() as string
  const [t, tCommon, categories, assignableUsers, options] = await Promise.all([
    getTranslations('inventory'),
    getTranslations('common'),
    getCachedCategoriesForSelect(tenantId),
    getAssignableUsers(tenantId),
    // Services and goods share the unit list and the sku sequence.
    getCachedProductFormOptions(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addService')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/inventory` },
          { label: t('services'), href: `/${lang}/inventory/services` },
          { label: tCommon('add') },
        ]}
      />
      <ServiceForm categories={categories} lang={lang} assignableUsers={assignableUsers} options={options} />
    </div>
  )
}
