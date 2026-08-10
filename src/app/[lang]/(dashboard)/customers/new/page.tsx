import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { CustomerForm } from '@/components/sales/customer-form'
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
  const [t, tCommon] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('addCustomer')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('customers'), href: `/${lang}/customers` },
          { label: tCommon('add') },
        ]}
      />
      <div className="px-4 md:px-8">
        <CustomerForm lang={lang} />
      </div>
    </div>
  )
}
