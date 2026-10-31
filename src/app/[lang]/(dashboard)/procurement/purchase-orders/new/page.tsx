import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { PurchaseOrderForm } from '@/components/procurement/purchase-order-form'
import { getCachedSuppliersForSelect, getCachedProductsForSelect, getAssignableUsers, getCashboxesForSelect } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireResourceAction } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'procurement' })
  return { title: t('addPurchase') }
}

// This page picks products from a live list that must reflect anything just
// added elsewhere — without this, Next.js treats it as a static route and can
// serve an already-prefetched, stale client-side copy after navigation, even
// though the server-side products cache tag was correctly invalidated.
export const dynamic = 'force-dynamic'

export default async function NewPurchaseOrderPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireResourceAction('procurement', 'purchases', 'create', lang, '/procurement/purchase-orders')
  const tenantId = await getCurrentTenantId() as string
  const [t, suppliers, products, assignableUsers, cashboxes] = await Promise.all([
    getTranslations('procurement'),
    getCachedSuppliersForSelect(tenantId),
    getCachedProductsForSelect(tenantId),
    getAssignableUsers(tenantId),
    getCashboxesForSelect(tenantId),
  ])

  return (
    <div>
      <PageHeader
        title={t('addPurchase')}
        subtitle={t('title')}
        breadcrumbs={[
          { label: 'Falco', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('purchases'), href: `/${lang}/procurement/purchase-orders` },
          { label: t('addPurchase') },
        ]}
      />
      <PurchaseOrderForm
        suppliers={suppliers}
        products={products}
        cashboxes={cashboxes}
        lang={lang}
        assignableUsers={assignableUsers}
      />
    </div>
  )
}
