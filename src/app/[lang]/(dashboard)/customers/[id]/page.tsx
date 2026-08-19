import { getCachedCustomerDetails } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
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
  const tenantId = await getCurrentTenantId() as string
  const [t, tNav, details] = await Promise.all([
    getTranslations('sales'),
    getTranslations('nav'),
    getCachedCustomerDetails(id, tenantId),
  ])

  if (!details || !details.customer) {
    notFound()
  }

  const { customer, salesOrders, invoices, transactions } = details

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={customer.name}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: tNav('customers'), href: `/${lang}/customers` },
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
        transactions={transactions}
      />
    </div>
  )
}
