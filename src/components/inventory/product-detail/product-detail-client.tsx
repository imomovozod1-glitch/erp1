'use client'

import { useTranslations } from 'next-intl'
import { exportProductDetail } from './product-detail-export'
import { ProductHistoryTabs } from './product-history-tabs'
import { ProductBanner, ProductKpis } from './product-summary'
import type { ProductCostLayer, ProductMovement, ProductPurchaseLine, ProductSaleLine } from './product-detail-types'

interface ProductDetailClientProps {
  lang: string
  product: any
  movements: ProductMovement[]
  sales: ProductSaleLine[]
  purchases: ProductPurchaseLine[]
  costLayers?: ProductCostLayer[]
  effectiveCostingMethod?: string
  nextSaleCost?: number | null
}

export function ProductDetailClient({
  product,
  movements,
  sales,
  purchases,
  costLayers = [],
  effectiveCostingMethod,
  nextSaleCost,
}: ProductDetailClientProps) {
  const t = useTranslations()
  const history = { movements, sales, purchases, costLayers }
  return (
    <div className="space-y-6">
      <ProductBanner product={product} onExport={() => exportProductDetail(product, history, t)} />
      <ProductKpis product={product} costingMethod={effectiveCostingMethod} nextSaleCost={nextSaleCost} />
      <ProductHistoryTabs history={history} unit={product.unit} />
    </div>
  )
}
