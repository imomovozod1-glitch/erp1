import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCachedProducts, getCachedCategories, getCachedCustomers } from '@/lib/data/queries'
import { POSClient } from '@/components/pos/pos-client'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'pos' })
  return { title: t('title') }
}

export default async function POSPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const [products, categories, customers] = await Promise.all([
    getCachedProducts(),
    getCachedCategories(),
    getCachedCustomers(),
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
