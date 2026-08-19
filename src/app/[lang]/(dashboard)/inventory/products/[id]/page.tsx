import { getCachedProductDetails } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { ProductDetailClient } from '@/components/inventory/product-detail-client'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

interface ProductDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id, lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const t = await getTranslations('inventory')
  const { product, movements, sales, purchases, costLayers, effectiveCostingMethod, nextSaleCost } = await getCachedProductDetails(id, tenantId)

  if (!product) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={product.name}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title', { fallback: 'Ombor' }), href: `/${lang}/inventory/products` },
          { label: product.name }
        ]}
      >
        <PageClock lang={lang} />
      </PageHeader>

      <ProductDetailClient
        lang={lang}
        product={product}
        movements={movements}
        sales={sales}
        purchases={purchases}
        costLayers={costLayers}
        effectiveCostingMethod={effectiveCostingMethod}
        nextSaleCost={nextSaleCost}
      />
    </div>
  )
}
