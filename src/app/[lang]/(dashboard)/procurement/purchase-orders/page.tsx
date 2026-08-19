import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { PurchaseOrdersTable } from '@/components/procurement/purchase-orders-table'
import { getCachedPurchaseOrders } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export const revalidate = 30

export const metadata: Metadata = { title: 'Purchase Orders' }

export default async function PurchaseOrdersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const [t, orders] = await Promise.all([
    getTranslations('procurement'),
    getCachedPurchaseOrders(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('purchases')}
        subtitle={t('title')}
        action={{ label: t('addPurchase'), href: `/${lang}/procurement/purchase-orders/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('purchases') },
        ]}
      />
      <PurchaseOrdersTable orders={orders} lang={lang} />
    </div>
  )
}
