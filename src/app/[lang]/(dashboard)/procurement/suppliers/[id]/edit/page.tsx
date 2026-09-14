import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { SupplierForm } from '@/components/procurement/supplier-form'
import { getCachedSupplierById, getAssignableUsers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireModuleEdit } from '@/lib/permissions-server'

export const metadata: Metadata = { title: 'Edit Supplier' }

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('procurement', lang, '/procurement/suppliers')
  const tenantId = (await getCurrentTenantId()) as string
  // Batched, not chained: neither read depends on the other's result.
  const [assignableUsers, t, supplier] = await Promise.all([
    getAssignableUsers(tenantId),
    getTranslations('procurement'),
    getCachedSupplierById(id, tenantId),
  ])

  if (!supplier) notFound()

  return (
    <div>
      <PageHeader
        title={t('editSupplier')}
        subtitle={t('title')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('suppliers'), href: `/${lang}/procurement/suppliers` },
          { label: t('editSupplier') },
        ]}
      />
      <SupplierForm initialData={supplier} lang={lang} assignableUsers={assignableUsers} />
    </div>
  )
}
