import { getCachedProductDetails, getCachedProductBoms } from '@/lib/data/queries'
import { ProductBomsCard } from '@/components/production/product-boms-card'
import { canEditModule, canViewModule } from '@/lib/permissions-server'
import { getCurrentTenantId } from '@/lib/tenant'
import { ProductDetailClient } from '@/components/inventory/product-detail-client'
import { PageHeader } from '@/components/shared/page-header'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

interface ProductDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id, lang } = await params
  const tenantId = await getCurrentTenantId() as string
  // The composition card is part of the Sanoat module, so it is shown only to
  // someone who may see that module — the product page itself is Ombor.
  const [t, canSeeProduction, canEditProduction, details] = await Promise.all([
    getTranslations('inventory'),
    canViewModule('production'),
    canEditModule('production'),
    getCachedProductDetails(id, tenantId),
  ])
  const { product, movements, sales, purchases, costLayers, effectiveCostingMethod, nextSaleCost } = details

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
      />

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

      {canSeeProduction && (
        <ProductBomsCard
          boms={await getCachedProductBoms(id, tenantId)}
          productId={id}
          lang={lang}
          canEdit={canEditProduction}
        />
      )}
    </div>
  )
}
