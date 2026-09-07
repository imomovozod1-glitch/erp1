import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { SupplierForm } from '@/components/procurement/supplier-form'
import { requireModuleEdit } from '@/lib/permissions-server'

export const metadata: Metadata = { title: 'Add Supplier' }

export default async function NewSupplierPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('procurement', lang, '/procurement/suppliers')
  const t = await getTranslations('procurement')

  return (
    <div>
      <PageHeader
        title={t('addSupplier')}
        subtitle={t('title')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('suppliers'), href: `/${lang}/procurement/suppliers` },
          { label: t('addSupplier') },
        ]}
      />
      <SupplierForm lang={lang} />
    </div>
  )
}
