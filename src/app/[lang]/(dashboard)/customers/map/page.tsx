import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { AllCustomersMap } from '@/components/sales/all-customers-map'
import { getCachedCustomers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Customers map' }

export default async function CustomersMapPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const [t, tNav, customers] = await Promise.all([
    getTranslations('sales'),
    getTranslations('nav'),
    getCachedCustomers(tenantId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('customersMap')}
        subtitle={t('customersMapSubtitle')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: tNav('customers'), href: `/${lang}/customers` },
          { label: t('customersMap') },
        ]}
      />

      <AllCustomersMap customers={customers} lang={lang} />
    </div>
  )
}
