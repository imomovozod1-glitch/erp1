import { getCachedCustomerDetails, getCachedCustomerDistribution } from '@/lib/data/queries'
import { CustomerRoutesCard } from '@/components/distribution/customer-routes-card'
import { canEditRecord, canViewModule, requireResourceView } from '@/lib/permissions-server'
import { getCurrentTenantId } from '@/lib/tenant'
import { CustomerDetailClient } from '@/components/sales/customer-detail-client'
import { PageHeader } from '@/components/shared/page-header'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Pencil } from 'lucide-react'

interface CustomerDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id, lang } = await params
  await requireResourceView('customers', 'list', lang)
  const tenantId = await getCurrentTenantId() as string
  const [t, tNav, tCommon, canSeeDistribution, details] = await Promise.all([
    getTranslations('sales'),
    getTranslations('nav'),
    getTranslations('common'),
    // The rounds strip belongs to the Distribution module; this page is Sales.
    canViewModule('distribution'),
    getCachedCustomerDetails(id, tenantId),
  ])

  if (!details || !details.customer) {
    notFound()
  }

  const { customer, salesOrders, invoices, transactions } = details
  const canEdit = await canEditRecord('customers', 'list', customer.assigned_to)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={customer.name}
        action={canEdit ? { label: tCommon('edit'), href: `/${lang}/customers/${id}/edit`, icon: Pencil } : undefined}
        breadcrumbs={[
          { label: 'Falco', href: `/${lang}/dashboard` },
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
