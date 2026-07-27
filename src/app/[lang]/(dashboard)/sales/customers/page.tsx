import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { CustomersTable } from '@/components/sales/customers-table'
import { getCachedCustomers } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'Customers' }

export default async function CustomersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, customers] = await Promise.all([
    getTranslations('sales'),
    getCachedCustomers(),
  ])

  return (
    <div>
      <PageHeader
        title={t('customers')}
        subtitle={t('title')}
        action={{ label: t('addCustomer'), href: `/${lang}/sales/customers/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('customers') },
        ]}
      />
      <CustomersTable customers={customers} lang={lang} />
    </div>
  )
}
