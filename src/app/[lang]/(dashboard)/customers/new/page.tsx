import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { CustomerForm } from '@/components/sales/customer-form'
import { getCachedCustomerCategories } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'sales' })
  return { title: t('addCustomer') }
}

export default async function NewCustomerPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const [t, tCommon, tNav, categories] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getTranslations('nav'),
    getCachedCustomerCategories(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addCustomer')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: tNav('customers'), href: `/${lang}/customers` },
          { label: t('customers'), href: `/${lang}/customers` },
          { label: tCommon('add') },
        ]}
      />
      <div className="px-4 md:px-8">
        <CustomerForm categories={categories} lang={lang} />
      </div>
    </div>
  )
}
