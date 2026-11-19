'use client'

import Image from 'next/image'
import { Layers, Package, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DetailBanner, KpiGrid, KpiTile as Kpi } from '@/components/shared/detail-page'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

export function ProductBanner({ product, onExport }: { product: any; onExport: () => void }) {
  const leading = product.image_url ? (
    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border">
      <Image src={product.image_url} alt={product.name} fill sizes="56px" className="object-cover" />
    </span>
  ) : (
    <span className="shrink-0 rounded-xl bg-brand-subtle p-3 text-violet-600 dark:text-violet-400">
      <Package className="size-7" />
    </span>
  )
  return <DetailBanner leading={leading} title={product.name} subtitle={<span className="font-mono">SKU: {product.sku}</span>} active={product.is_active} onExport={onExport} />
}

interface ProductKpisProps {
  product: any
  costingMethod?: string
  nextSaleCost?: number | null
}

export function ProductKpis({ product, costingMethod, nextSaleCost }: ProductKpisProps) {
  const t = useTranslations('inventory')
  const margin = product.price > 0 ? (((product.price - product.cost_price) / product.price) * 100).toFixed(1) : '0'
  const low = product.stock <= product.min_stock
  return (
    <KpiGrid>
      <Kpi label={t('costPrice')} value={formatCurrency(product.cost_price)}>
        <p>
          {t('incomingCost')}: {formatCurrency(product.incoming_cost || product.cost_price)}
        </p>
        {costingMethod && nextSaleCost != null && (
          <p className="flex items-center gap-1 font-semibold text-violet-600 dark:text-violet-400">
            <Layers className="size-3" />
            {t(costingMethod)} · {t('nextSaleCost')}: {formatCurrency(nextSaleCost)}
          </p>
        )}
      </Kpi>
      <Kpi label={t('price')} value={formatCurrency(product.price)}>
        <p className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="size-3" />
          {t('profitMargin')}: {margin}%
        </p>
      </Kpi>
      <Kpi label={t('stock')} value={`${formatNumber(product.stock)} ${product.unit}`}>
        <p className={cn('font-semibold', low ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground')}>
          {t('minStock')}: {formatNumber(product.min_stock)} {product.unit}
        </p>
      </Kpi>
      <Kpi label={t('stockValue')} value={formatCurrency(product.stock * product.cost_price)}>
        <p>
          {t('category')}: {product.categories?.name ?? '—'}
        </p>
      </Kpi>
    </KpiGrid>
  )
}
