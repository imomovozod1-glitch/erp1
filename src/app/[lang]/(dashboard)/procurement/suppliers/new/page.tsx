import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { SupplierForm } from '@/components/procurement/supplier-form'

export const metadata: Metadata = { title: 'Add Supplier' }

export default async function NewSupplierPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
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
