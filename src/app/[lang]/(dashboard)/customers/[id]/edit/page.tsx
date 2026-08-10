import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { CustomerForm } from '@/components/sales/customer-form'
import { getCachedCustomerById } from '@/lib/data/queries'
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
  const [t, tCommon, customer] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getCachedCustomerById(id),
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
          { label: t('customers'), href: `/${lang}/customers` },
          { label: tCommon('edit') },
        ]}
      />
      <div className="px-4 md:px-8">
        <CustomerForm initialData={customer} lang={lang} />
      </div>
    </div>
  )
}
