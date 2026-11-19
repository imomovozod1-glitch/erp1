'use client'

import { Factory, Layers, RefreshCw, ShoppingCart, Truck, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResponsiveTable } from '@/components/shared/responsive-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { translateMovementReason } from '@/lib/movement-reason'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils'
import {
  COST_LAYER_SOURCE_KEYS,
  isIncoming,
  type MovementSource,
  type ProductHistory,
  type ProductMovement,
} from './product-detail-types'

const TABS: { key: keyof ProductHistory; icon: LucideIcon; label: string }[] = [
  { key: 'movements', icon: RefreshCw, label: 'movementHistory' },
  { key: 'sales', icon: ShoppingCart, label: 'salesHistory' },
  { key: 'purchases', icon: Truck, label: 'purchaseHistory' },
  { key: 'costLayers', icon: Layers, label: 'costLayers' },
]

const SOURCE_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  purchase_order: { icon: Truck, tone: 'text-amber-700 dark:text-amber-400' },
  sales_orders: { icon: ShoppingCart, tone: 'text-violet-700 dark:text-violet-400' },
  production_orders: { icon: Factory, tone: 'text-indigo-700 dark:text-indigo-400' },
}

const dateOf = (value?: string) => (value ? formatDateTime(value) : '—')

function useSourceText() {
  const t = useTranslations('inventory')
  return (source?: MovementSource | null) => {
    if (source?.type === 'initial_stock') return t('initialStock')
    if (source?.type === 'product_adjustment') return t('manualAdjustment')
    return source?.label ? [source.label, source.supplierOrCustomer].filter(Boolean).join(' · ') : undefined
  }
}

function SourceCell({ source }: { source?: MovementSource | null }) {
  const sourceText = useSourceText()
  const style = source?.type ? SOURCE_STYLE[source.type] : undefined
  const text = sourceText(source)
  if (!text) return <span className="text-muted-foreground">—</span>
  if (!style) return <span className="text-muted-foreground">{text}</span>
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${style.tone}`}>
      <style.icon className="size-3.5 shrink-0" />
      {text}
    </span>
  )
}

function MovementsTab({ movements, unit }: { movements: ProductMovement[]; unit?: string }) {
  const t = useTranslations()
  const inventory = (key: string) => t(`inventory.${key}`)
  const sourceText = useSourceText()
  const direction = (m: ProductMovement) => (
    <StatusBadge tone={isIncoming(m) ? 'emerald' : 'rose'} label={inventory(isIncoming(m) ? 'stockIn' : 'stockOut')} />
  )
  const signed = (m: ProductMovement) => `${isIncoming(m) ? '+' : '-'}${formatNumber(m.quantity)}`
  return (
    <ResponsiveTable
      rows={movements}
      rowKey={(m) => m.id}
      columns={[
        { key: 'type', header: inventory('movementType'), cell: direction },
        { key: 'qty', header: inventory('quantity'), align: 'right', className: 'font-semibold', cell: signed },
        { key: 'before', header: inventory('before'), align: 'right', className: 'text-muted-foreground', cell: (m) => formatNumber(m.quantity_before) },
        { key: 'after', header: inventory('after'), align: 'right', className: 'font-medium', cell: (m) => formatNumber(m.quantity_after) },
        { key: 'source', header: inventory('source'), className: 'text-sm', cell: (m) => <SourceCell source={m.source} /> },
        { key: 'reason', header: inventory('reason'), className: 'text-sm text-muted-foreground', cell: (m) => translateMovementReason(m.reason, inventory) },
        { key: 'date', header: t('common.date'), className: 'text-xs text-muted-foreground', cell: (m) => formatDateTime(m.created_at) },
      ]}
      card={(m) => ({
        eyebrow: <span>{formatDateTime(m.created_at)}</span>,
        title: `${signed(m)} ${unit ?? ''}`,
        subtitle: sourceText(m.source),
        status: direction(m),
        stats: [
          { label: inventory('before'), value: formatNumber(m.quantity_before) },
          { label: inventory('after'), value: formatNumber(m.quantity_after), tone: 'brand' },
        ],
        footer: m.reason ? <p className="text-xs break-words text-muted-foreground">{translateMovementReason(m.reason, inventory)}</p> : undefined,
      })}
    />
  )
}

function SalesTab({ sales }: Pick<ProductHistory, 'sales'>) {
  const t = useTranslations()
  return (
    <ResponsiveTable
      rows={sales}
      rowKey={(_, index) => String(index)}
      columns={[
        { key: 'order', header: t('sales.orderNumber'), className: 'font-semibold', cell: (s) => s.sales_orders?.order_number ?? '—' },
        { key: 'customer', header: t('sales.customer'), cell: (s) => s.sales_orders?.customers?.name ?? '—' },
        { key: 'qty', header: t('inventory.quantity'), align: 'right', className: 'font-medium', cell: (s) => formatNumber(s.quantity) },
        { key: 'amount', header: t('common.amount'), align: 'right', className: 'font-bold', cell: (s) => formatCurrency(s.total_price) },
        { key: 'date', header: t('common.date'), className: 'text-xs text-muted-foreground', cell: (s) => dateOf(s.sales_orders?.created_at) },
      ]}
      card={(s) => ({
        eyebrow: <span>{dateOf(s.sales_orders?.created_at)}</span>,
        title: s.sales_orders?.order_number ?? '—',
        subtitle: s.sales_orders?.customers?.name ?? undefined,
        stats: [
          { label: t('inventory.quantity'), value: formatNumber(s.quantity) },
          { label: t('common.amount'), value: formatCurrency(s.total_price), tone: 'brand' },
        ],
      })}
    />
  )
}

function PurchasesTab({ purchases }: Pick<ProductHistory, 'purchases'>) {
  const t = useTranslations()
  return (
    <ResponsiveTable
      rows={purchases}
      rowKey={(_, index) => String(index)}
      columns={[
        { key: 'po', header: t('procurement.poNumber'), className: 'font-semibold', cell: (p) => p.purchase_orders?.po_number ?? '—' },
        { key: 'supplier', header: t('procurement.supplier'), cell: (p) => p.purchase_orders?.suppliers?.name ?? '—' },
        { key: 'qty', header: t('inventory.quantity'), align: 'right', className: 'font-medium', cell: (p) => formatNumber(p.quantity) },
        { key: 'amount', header: t('common.amount'), align: 'right', className: 'font-bold', cell: (p) => formatCurrency(p.total_cost) },
        { key: 'date', header: t('common.date'), className: 'text-xs text-muted-foreground', cell: (p) => dateOf(p.purchase_orders?.created_at) },
      ]}
      card={(p) => ({
        eyebrow: <span>{dateOf(p.purchase_orders?.created_at)}</span>,
        title: p.purchase_orders?.po_number ?? '—',
        subtitle: p.purchase_orders?.suppliers?.name ?? undefined,
        stats: [
          { label: t('inventory.quantity'), value: formatNumber(p.quantity) },
          { label: t('common.amount'), value: formatCurrency(p.total_cost), tone: 'brand' },
        ],
      })}
    />
  )
}

function CostLayersTab({ costLayers }: Pick<ProductHistory, 'costLayers'>) {
  const t = useTranslations('inventory')
  const sourceOf = (type: string) => (COST_LAYER_SOURCE_KEYS[type] ? t(COST_LAYER_SOURCE_KEYS[type]) : type)
  const remaining = (l: ProductHistory['costLayers'][number]) => `${formatNumber(l.remaining_qty)} / ${formatNumber(l.quantity)}`
  const value = (l: ProductHistory['costLayers'][number]) => formatCurrency(l.remaining_qty * l.unit_cost)
  return (
    <ResponsiveTable
      rows={costLayers}
      rowKey={(l) => l.id}
      columns={[
        { key: 'received', header: t('receivedAt'), className: 'text-xs text-muted-foreground', cell: (l) => formatDateTime(l.received_at) },
        { key: 'source', header: t('source'), className: 'text-sm', cell: (l) => sourceOf(l.source_type) },
        { key: 'remaining', header: t('remainingQty'), align: 'right', className: 'font-medium', cell: remaining },
        { key: 'unitCost', header: t('unitCost'), align: 'right', cell: (l) => formatCurrency(l.unit_cost) },
        { key: 'value', header: t('value'), align: 'right', className: 'font-bold', cell: value },
      ]}
      card={(l) => ({
        eyebrow: <span>{formatDateTime(l.received_at)}</span>,
        title: sourceOf(l.source_type),
        stats: [
          { label: t('remainingQty'), value: remaining(l) },
          { label: t('unitCost'), value: formatCurrency(l.unit_cost) },
          { label: t('value'), value: value(l), tone: 'brand' },
        ],
      })}
    />
  )
}

export function ProductHistoryTabs({ history, unit }: { history: ProductHistory; unit?: string }) {
  const t = useTranslations('inventory')
  return (
    <Tabs defaultValue="movements" className="rounded-xl border bg-card shadow-sm">
      <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto border-b px-2 [scrollbar-width:none]">
        {TABS.map(({ key, icon: Icon, label }) => (
          <TabsTrigger key={key} value={key} className="flex-none px-4 py-3 font-semibold data-active:text-violet-600 dark:data-active:text-violet-400">
            <Icon className="size-4" />
            {t(label)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="movements">
        <MovementsTab movements={history.movements} unit={unit} />
      </TabsContent>
      <TabsContent value="sales">
        <SalesTab sales={history.sales} />
      </TabsContent>
      <TabsContent value="purchases">
        <PurchasesTab purchases={history.purchases} />
      </TabsContent>
      <TabsContent value="costLayers">
        <CostLayersTab costLayers={history.costLayers} />
      </TabsContent>
    </Tabs>
  )
}
