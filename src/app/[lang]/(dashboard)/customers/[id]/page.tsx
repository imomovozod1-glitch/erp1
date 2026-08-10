import { getCachedCustomerDetails } from '@/lib/data/queries'
import { CustomerDetailClient } from '@/components/sales/customer-detail-client'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

interface CustomerDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id, lang } = await params
  const t = await getTranslations('sales')
  const details = await getCachedCustomerDetails(id)

  if (!details || !details.customer) {
    notFound()
  }

  const { customer, salesOrders, invoices } = details

  return (
    <div className="flex flex-col gap-4 p-4 md:p-8 pt-6">
      <PageHeader
        title={customer.name}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('customers', { fallback: 'Mijozlar' }), href: `/${lang}/customers` },
          { label: customer.name }
        ]}
      >
        <PageClock lang={lang} />
      </PageHeader>

      <CustomerDetailClient
        lang={lang}
        customer={customer}
        salesOrders={salesOrders}
        invoices={invoices}
      />
    </div>
  )
}
