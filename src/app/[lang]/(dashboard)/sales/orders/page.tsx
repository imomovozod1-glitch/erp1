import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { OrdersTable } from '@/components/sales/orders-table'
import { getCachedOrders } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export const revalidate = 30

export const metadata: Metadata = { title: 'Orders' }

export default async function OrdersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('sales')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, orders] = await Promise.all([
    getTranslations('sales'),
    getTranslations('pageInfo'),
    getCachedOrders(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('orders')}
        subtitle={t('title')}
        info={tInfo('salesOrders')}
        action={canEdit ? { label: t('addSale'), href: `/${lang}/sales/orders/new`, icon: Plus } : undefined}
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
