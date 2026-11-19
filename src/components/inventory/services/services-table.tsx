'use client'

import { useRouter } from 'next/navigation'
import { Wrench } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCan } from '@/components/providers/permissions-provider'
import { MobileCard, MobileCardList, MobileChip, MobileThumb } from '@/components/shared/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { exportCatalog } from '../catalog/catalog-export'
import { ActiveBadge, CatalogShell, EmptyCatalog, ExportButton, MarginText, NameCell, SkuCode } from '../catalog/catalog-parts'
import { CatalogRowMenu } from '../catalog/catalog-row-menu'
import { catalogHref, marginOf, type CatalogItem, type CatalogPage } from '../catalog/catalog-types'
import { useCatalogActions, type CatalogActions } from '../catalog/use-catalog-actions'

interface ServicesTableProps extends CatalogPage {
  services: CatalogItem[]
}

interface RowProps {
  item: CatalogItem
  index: number
  page: CatalogPage
  actions: CatalogActions
}

export function ServicesTable({ services, ...page }: ServicesTableProps) {
  const t = useTranslations()
  const canExport = useCan('inventory', 'export', 'services')
  const actions = useCatalogActions('services')
  const exportServices = () =>
    exportCatalog(
      services,
      t,
      [
        { header: t('inventory.serviceName'), key: 'name' },
        { header: t('inventory.serviceCode'), key: 'sku' },
        { header: t('inventory.category'), key: 'categoryName' },
        { header: t('inventory.serviceCostPrice'), key: 'cost_price' },
        { header: t('inventory.price'), key: 'price' },
        { header: t('inventory.unit'), key: 'unit' },
        { header: t('common.status'), key: 'statusLabel' },
      ],
      'xizmatlar.xlsx'
    )

  return (
    <>
      <CatalogShell page={page} tools={canExport && <ExportButton onClick={exportServices} disabled={!services.length} />}>
        <Table containerClassName="max-md:hidden">
          <ServicesHead />
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10}>
                  <EmptyCatalog icon={Wrench} />
                </TableCell>
              </TableRow>
            ) : (
              services.map((item, index) => <ServiceRow key={item.id} item={item} index={index} page={page} actions={actions} />)
            )}
          </TableBody>
        </Table>
        <MobileCardList isEmpty={!services.length} empty={<EmptyCatalog icon={Wrench} />}>
          {services.map((item, index) => (
            <ServiceCard key={item.id} item={item} index={index} page={page} actions={actions} />
          ))}
        </MobileCardList>
      </CatalogShell>
      {actions.confirmDialog}
    </>
  )
}

function ServicesHead() {
  const t = useTranslations()
  return (
    <TableHeader>
      <TableRow className="bg-muted/40">
        <TableHead className="w-10 text-center">#</TableHead>
        <TableHead>{t('inventory.serviceName')}</TableHead>
        <TableHead>{t('inventory.serviceCode')}</TableHead>
        <TableHead>{t('inventory.category')}</TableHead>
        <TableHead>{t('inventory.unit')}</TableHead>
        <TableHead className="text-right">{t('inventory.costPrice')}</TableHead>
        <TableHead className="text-right">{t('inventory.price')}</TableHead>
        <TableHead className="text-right max-lg:hidden">{t('inventory.margin')}</TableHead>
        <TableHead>{t('common.status')}</TableHead>
        <TableHead className="w-12" />
      </TableRow>
    </TableHeader>
  )
}

function ServiceRow({ item, index, page, actions }: RowProps) {
  const router = useRouter()
  const href = catalogHref(page.lang, 'services', item.id, true)
  return (
    <TableRow className="cursor-pointer transition-colors" onClick={() => router.push(href)}>
      <TableCell className="text-center text-xs text-muted-foreground">{(page.page - 1) * page.pageSize + index + 1}</TableCell>
      <TableCell>
        <NameCell item={item} href={href} />
      </TableCell>
      <TableCell>
        <SkuCode sku={item.sku} />
      </TableCell>
      <TableCell>{item.categories?.name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{item.unit}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.cost_price)}</TableCell>
      <TableCell className="text-right font-bold text-violet-600 tabular-nums dark:text-violet-400">{formatCurrency(item.price)}</TableCell>
      <TableCell className="text-right tabular-nums max-lg:hidden">
        <MarginText margin={marginOf(item)} />
      </TableCell>
      <TableCell>
        <ActiveBadge active={item.is_active} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <CatalogRowMenu kind="services" item={item} lang={page.lang} actions={actions} />
      </TableCell>
    </TableRow>
  )
}

function ServiceCard({ item, page, actions }: RowProps) {
  const t = useTranslations('inventory')
  const router = useRouter()
  const margin = marginOf(item)
  return (
    <MobileCard
      onClick={() => router.push(catalogHref(page.lang, 'services', item.id, true))}
      leading={<MobileThumb fallback={<Wrench />} />}
      eyebrow={
        <>
          <MobileChip>{item.sku}</MobileChip>
          {item.categories?.name && <span className="truncate">{item.categories.name}</span>}
        </>
      }
      title={item.name}
      subtitle={item.description || undefined}
      status={<ActiveBadge active={item.is_active} />}
      menu={<CatalogRowMenu kind="services" item={item} lang={page.lang} actions={actions} />}
      stats={[
        { label: t('price'), value: formatCurrency(item.price), tone: 'brand' },
        { label: t('costPrice'), value: formatCurrency(item.cost_price) },
        {
          label: t('margin'),
          value: margin === null ? '—' : `${margin.toFixed(1)}%`,
          tone: margin === null ? 'default' : margin >= 0 ? 'good' : 'bad',
        },
      ]}
    />
  )
}
