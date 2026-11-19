'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Package } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { MobileCard, MobileCardList, MobileChip, MobileThumb } from '@/components/shared/mobile-list'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { ActiveBadge, CatalogShell, CatalogThumb, EmptyCatalog, NameCell, SkuCode } from '../catalog/catalog-parts'
import { CatalogRowMenu } from '../catalog/catalog-row-menu'
import { catalogHref, stockStateOf, type CatalogItem, type CatalogPage, type StockState } from '../catalog/catalog-types'
import { useCatalogActions, type CatalogActions } from '../catalog/use-catalog-actions'
import { ProductTools } from './product-tools'

const AIStockScannerModal = dynamic(() => import('../ai-scanner/ai-stock-scanner-modal').then((m) => m.AIStockScannerModal), { ssr: false })

interface ProductsTableProps extends CatalogPage {
  products: CatalogItem[]
}

interface RowProps {
  item: CatalogItem
  index: number
  page: CatalogPage
  actions: CatalogActions
}

const STOCK_BADGE: Record<StockState, { tone: StatusTone; label: string; stat: 'bad' | 'warn' | 'good' }> = {
  out: { tone: 'rose', label: 'inventory.outOfStock', stat: 'bad' },
  low: { tone: 'amber', label: 'inventory.stockLow', stat: 'warn' },
  ok: { tone: 'emerald', label: 'inventory.inStock', stat: 'good' },
}

export function ProductsTable({ products, ...page }: ProductsTableProps) {
  const [scanning, setScanning] = useState(false)
  const actions = useCatalogActions('products')
  return (
    <>
      <CatalogShell page={page} tools={<ProductTools products={products} onScan={() => setScanning(true)} />}>
        <Table containerClassName="max-md:hidden">
          <ProductsHead />
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10}>
                  <EmptyCatalog icon={Package} />
                </TableCell>
              </TableRow>
            ) : (
              products.map((item, index) => <ProductRow key={item.id} item={item} index={index} page={page} actions={actions} />)
            )}
          </TableBody>
        </Table>
        <MobileCardList isEmpty={!products.length} empty={<EmptyCatalog icon={Package} />}>
          {products.map((item, index) => (
            <ProductCard key={item.id} item={item} index={index} page={page} actions={actions} />
          ))}
        </MobileCardList>
      </CatalogShell>
      {scanning && <AIStockScannerModal open onOpenChange={setScanning} lang={page.lang} />}
      {actions.confirmDialog}
    </>
  )
}

function ProductsHead() {
  const t = useTranslations()
  return (
    <TableHeader>
      <TableRow className="bg-muted/40">
        <TableHead className="w-10 text-center">#</TableHead>
        <TableHead>{t('inventory.productName')}</TableHead>
        <TableHead>{t('inventory.sku')}</TableHead>
        <TableHead>{t('inventory.category')}</TableHead>
        <TableHead className="text-right">{t('inventory.costPrice')}</TableHead>
        <TableHead className="text-right max-lg:hidden">{t('inventory.incomingCost')}</TableHead>
        <TableHead className="text-right">{t('inventory.price')}</TableHead>
        <TableHead className="text-right">{t('inventory.stock')}</TableHead>
        <TableHead>{t('common.status')}</TableHead>
        <TableHead className="w-12" />
      </TableRow>
    </TableHeader>
  )
}

function ProductRow({ item, index, page, actions }: RowProps) {
  const router = useRouter()
  const href = catalogHref(page.lang, 'products', item.id)
  const low = Number(item.stock) <= Number(item.min_stock)
  return (
    <TableRow className="cursor-pointer transition-colors" onClick={() => router.push(href)}>
      <TableCell className="text-center text-xs text-muted-foreground">{(page.page - 1) * page.pageSize + index + 1}</TableCell>
      <TableCell>
        <NameCell item={item} href={href} leading={<CatalogThumb item={item} icon={Package} />} />
      </TableCell>
      <TableCell>
        <SkuCode sku={item.sku} />
      </TableCell>
      <TableCell>{item.categories?.name ?? '—'}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.cost_price)}</TableCell>
      <TableCell className="text-right font-medium text-muted-foreground tabular-nums max-lg:hidden">
        {formatCurrency(item.incoming_cost || 0)}
      </TableCell>
      <TableCell className="text-right font-bold text-violet-600 tabular-nums dark:text-violet-400">{formatCurrency(item.price)}</TableCell>
      <TableCell className={cn('text-right font-semibold tabular-nums', low && 'font-bold text-rose-600 dark:text-rose-400')}>
        {formatNumber(Number(item.stock))} {item.unit}
      </TableCell>
      <TableCell>
        <ActiveBadge active={item.is_active} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <CatalogRowMenu kind="products" item={item} lang={page.lang} actions={actions} />
      </TableCell>
    </TableRow>
  )
}

function ProductCard({ item, page, actions }: RowProps) {
  const t = useTranslations()
  const router = useRouter()
  const stock = STOCK_BADGE[stockStateOf(item)]
  return (
    <MobileCard
      onClick={() => router.push(catalogHref(page.lang, 'products', item.id))}
      leading={<MobileThumb src={item.image_url ?? undefined} alt={item.name} fallback={<Package />} />}
      eyebrow={
        <>
          <MobileChip>{item.sku}</MobileChip>
          {item.categories?.name && <span className="truncate">{item.categories.name}</span>}
        </>
      }
      title={item.name}
      status={item.is_active ? <StatusBadge tone={stock.tone} label={t(stock.label)} /> : <ActiveBadge active={false} />}
      menu={<CatalogRowMenu kind="products" item={item} lang={page.lang} actions={actions} />}
      stats={[
        { label: t('inventory.price'), value: formatCurrency(item.price), tone: 'brand' },
        { label: t('inventory.costPrice'), value: formatCurrency(item.cost_price) },
        { label: t('inventory.stock'), value: `${formatNumber(Number(item.stock))} ${item.unit}`, tone: stock.stat },
      ]}
    />
  )
}
