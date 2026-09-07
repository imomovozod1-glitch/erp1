import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { PurchaseOrdersTable } from '@/components/procurement/purchase-orders-table'
import { getCachedPurchaseOrders } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { canEditModule } from '@/lib/permissions-server'

export const revalidate = 30

export const metadata: Metadata = { title: 'Purchase Orders' }

export default async function PurchaseOrdersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Don't offer an action the user isn't allowed to complete — the
  // /new route guard would just bounce them straight back.
  const canEdit = await canEditModule('procurement')
  const tenantId = await getCurrentTenantId() as string
  const [t, tInfo, orders] = await Promise.all([
    getTranslations('procurement'),
    getTranslations('pageInfo'),
    getCachedPurchaseOrders(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('purchases')}
        subtitle={t('title')}
        info={tInfo('purchaseOrders')}
        action={canEdit ? { label: t('addPurchase'), href: `/${lang}/procurement/purchase-orders/new`, icon: Plus } : undefined}
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
