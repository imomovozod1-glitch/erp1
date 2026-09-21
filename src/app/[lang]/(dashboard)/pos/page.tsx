import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCachedProducts, getCachedCategories, getCachedCustomers } from '@/lib/data/queries'
import { getCurrentTenantId, getCachedTenant } from '@/lib/tenant'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { POSClient } from '@/components/pos/pos-client'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'pos' })
  return { title: t('title') }
}

// Cashiers must always see the current product/price/stock list — without this,
// Next.js treats this as a static route and can serve an already-prefetched,
// stale client-side copy after navigation, even though the server-side products
// cache tag was correctly invalidated.
export const dynamic = 'force-dynamic'

export default async function POSPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const user = await getSessionUser()
  const [products, categories, customers, tenant, profile] = await Promise.all([
    getCachedProducts(tenantId),
    getCachedCategories(tenantId),
    getCachedCustomers(tenantId),
    getCachedTenant(tenantId),
    // The cashier's name is printed on the receipt. Read here, from cache, so
    // the receipt can be shown the instant the button is pressed rather than
    // after a round trip that only exists to fetch this one string.
    user ? getCachedProfile(user.id) : Promise.resolve(null),
  ])

  // Filter only active products for the POS screen
  const activeProducts = products.filter((p: any) => p.is_active)

  return (
    <POSClient
      initialProducts={activeProducts}
      initialCategories={categories}
      initialCustomers={customers}
      company={{
        name: (tenant as any)?.company_name || 'Falco ERP',
        phone: (tenant as any)?.phone || undefined,
      }}
      cashierName={(profile as any)?.full_name || 'Cashier'}
      lang={lang}
    />
  )
}
