import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { SaleForm } from '@/components/sales/sale-form'
import { getCachedProductsForSelect, getCachedCustomersForSelect, getAssignableUsers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireModuleEdit } from '@/lib/permissions-server'

export const metadata: Metadata = { title: 'New Sale' }

// This page picks products from a live list that must reflect anything just
// added elsewhere — without this, Next.js treats it as a static route and can
// serve an already-prefetched, stale client-side copy after navigation, even
// though the server-side products cache tag was correctly invalidated.
export const dynamic = 'force-dynamic'

export default async function NewSalePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Creating/editing needs the module's Edit permission, not just View.
  await requireModuleEdit('sales', lang, '/sales/orders')
  const tenantId = await getCurrentTenantId() as string
  const [t, products, customers, assignableUsers] = await Promise.all([
    getTranslations('sales'),
    getCachedProductsForSelect(tenantId),
    getCachedCustomersForSelect(tenantId),
    getAssignableUsers(tenantId),
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
      <SaleForm products={products} customers={customers} assignableUsers={assignableUsers} lang={lang} />
    </div>
  )
}
