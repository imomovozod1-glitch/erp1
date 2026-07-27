import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { SaleForm } from '@/components/sales/sale-form'
import { getCachedProductsForSelect, getCachedCustomersForSelect } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'New Sale' }

export default async function NewSalePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, products, customers] = await Promise.all([
    getTranslations('sales'),
    getCachedProductsForSelect(),
    getCachedCustomersForSelect(),
  ])

  return (
    <div>
      <PageHeader
        title={t('addSale')}
        subtitle={t('title')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('orders'), href: `/${lang}/sales/orders` },
          { label: t('addSale') },
        ]}
      />
      <SaleForm products={products} customers={customers} lang={lang} />
    </div>
  )
}
