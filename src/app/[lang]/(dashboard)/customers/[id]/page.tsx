import { getCachedCustomerDetails, getCachedCustomerDistribution } from '@/lib/data/queries'
import { CustomerRoutesCard } from '@/components/distribution/customer-routes-card'
import { canViewModule } from '@/lib/permissions-server'
import { getCurrentTenantId } from '@/lib/tenant'
import { CustomerDetailClient } from '@/components/sales/customer-detail-client'
import { PageHeader } from '@/components/shared/page-header'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

interface CustomerDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id, lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const [t, tNav, canSeeDistribution, details] = await Promise.all([
    getTranslations('sales'),
    getTranslations('nav'),
    // The rounds strip belongs to the Distribution module; this page is Sales.
    canViewModule('distribution'),
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
      />

      <CustomerDetailClient
        lang={lang}
        customer={customer}
        salesOrders={salesOrders}
        invoices={invoices}
        transactions={transactions}
      />

      {canSeeDistribution && (
        <CustomerRoutesCard {...(await getCachedCustomerDistribution(id, tenantId))} lang={lang} />
      )}
    </div>
  )
}
