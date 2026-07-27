import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { SupplierForm } from '@/components/procurement/supplier-form'
import { getCachedSupplierById } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'Edit Supplier' }

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const t = await getTranslations('procurement')
  const supplier = await getCachedSupplierById(id)

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
      <SupplierForm initialData={supplier} lang={lang} />
    </div>
  )
}
