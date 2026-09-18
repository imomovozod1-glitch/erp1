import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { BomForm } from '@/components/production/bom-form'
import { Metadata } from 'next'
import { requireModuleEdit } from '@/lib/permissions-server'
import { getCachedProductsForSelect, getAssignableUsers, getCachedBomDetails } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'production' })
  return { title: t('editBom') }
}

export default async function EditBomPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const tenantId = (await getCurrentTenantId()) as string
  await requireModuleEdit('production', lang, '/production/boms')

  const [t, tCommon, products, assignableUsers, details] = await Promise.all([
    getTranslations('production'),
    getTranslations('common'),
    getCachedProductsForSelect(tenantId, { includeServices: true }),
    getAssignableUsers(tenantId),
    getCachedBomDetails(id, tenantId),
  ])

  if (!details.bom) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('editBom')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/production` },
          { label: t('boms'), href: `/${lang}/production/boms` },
          { label: tCommon('edit') },
        ]}
      />
      <BomForm
        initialData={details.bom}
        initialItems={details.items}
        products={products}
        lang={lang}
        assignableUsers={assignableUsers}
      />
    </div>
  )
}
