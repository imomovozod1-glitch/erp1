import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { OrdersTable } from '@/components/sales/orders-table'
import { getCachedOrders } from '@/lib/data/queries'

export const revalidate = 30

export const metadata: Metadata = { title: 'Orders' }

export default async function OrdersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, orders] = await Promise.all([
    getTranslations('sales'),
    getCachedOrders(),
  ])

  return (
    <div>
      <PageHeader
        title={t('orders')}
        subtitle={t('title')}
        action={{ label: t('addSale'), href: `/${lang}/sales/orders/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('orders') },
        ]}
      />
      <OrdersTable orders={orders} lang={lang} />
    </div>
  )
}
