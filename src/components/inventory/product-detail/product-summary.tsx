'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { Download, Layers, Package, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { ActiveBadge } from '../catalog/catalog-parts'

export function ProductBanner({ product, onExport }: { product: any; onExport: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:rounded-xl md:p-5">
      <div className="flex min-w-0 items-center gap-3.5">
        {product.image_url ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border">
            <Image src={product.image_url} alt={product.name} fill sizes="56px" className="object-cover" />
          </span>
        ) : (
          <span className="shrink-0 rounded-xl bg-brand-subtle p-3 text-violet-600 dark:text-violet-400">
            <Package className="size-7" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight break-words text-foreground">{product.name}</h1>
          <p className="mt-1 font-mono text-xs break-all text-muted-foreground">SKU: {product.sku}</p>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        <ActiveBadge active={product.is_active} />
        <Button onClick={onExport} size="sm" className="gap-2 max-md:h-10">
          <Download className="size-4" />
          {t('export')}
        </Button>
      </div>
    </div>
  )
}

function Kpi({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex flex-col gap-1 p-5">
        <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
        <h3 className="text-xl font-extrabold tracking-tight break-words text-foreground tabular-nums md:text-2xl">{value}</h3>
        <div className="mt-1 space-y-1 text-xs">{children}</div>
      </CardContent>
    </Card>
  )
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
      <Kpi label={t('costPrice')} value={formatCurrency(product.cost_price)}>
        <p className="text-muted-foreground">
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
        <p className="text-muted-foreground">
          {t('category')}: {product.categories?.name ?? '—'}
        </p>
      </Kpi>
    </div>
  )
}
