import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ProductsTable } from '@/components/inventory/products-table'
import { getCachedProducts } from '@/lib/data/queries'

// Cache the full page response for 60 seconds
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'inventory' })
  return { title: t('products') }
}

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const [t, products] = await Promise.all([
    getTranslations('inventory'),
    getCachedProducts(),
  ])

  return (
    <div>
      <PageHeader
        title={t('products')}
        subtitle={t('title')}
        action={{
          label: t('addProduct'),
          href: `/${lang}/inventory/products/new`,
          icon: Plus,
        }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('products') },
        ]}
      />
      <ProductsTable products={products} lang={lang} />
    </div>
  )
}

