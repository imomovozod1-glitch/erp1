import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { CustomerForm } from '@/components/sales/customer-form'
import { getCachedCustomerById, getCachedCustomerCategories } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: t('editCustomer') }
}

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  const tenantId = await getCurrentTenantId() as string
  const [t, tCommon, tNav, customer, categories] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getTranslations('nav'),
    getCachedCustomerById(id, tenantId),
    getCachedCustomerCategories(tenantId),
  ])

  if (!customer) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('editCustomer')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: tNav('customers'), href: `/${lang}/customers` },
          { label: t('customers'), href: `/${lang}/customers` },
          { label: tCommon('edit') },
        ]}
      />
      <div className="px-4 md:px-8">
        <CustomerForm initialData={customer} categories={categories} lang={lang} />
      </div>
    </div>
  )
}
