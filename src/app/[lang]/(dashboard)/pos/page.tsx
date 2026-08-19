import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCachedProducts, getCachedCategories, getCachedCustomers } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
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
  const [products, categories, customers] = await Promise.all([
    getCachedProducts(tenantId),
    getCachedCategories(tenantId),
    getCachedCustomers(tenantId),
  ])

  // Filter only active products for the POS screen
  const activeProducts = products.filter((p: any) => p.is_active)

  return (
    <POSClient
      initialProducts={activeProducts}
      initialCategories={categories}
      initialCustomers={customers}
      lang={lang}
    />
  )
}
