'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { ResponsiveTable } from '@/components/shared/responsive-table'
import { isService } from '@/lib/product-kind'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { isShortLine, type RunCosting } from './run-costing'

const TAG = 'ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase'

function Tag({ tone, children }: { tone: 'amber' | 'slate'; children: ReactNode }) {
  const color = tone === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-muted text-muted-foreground'
  return <span className={cn(TAG, color)}>{children}</span>
}

function LinesCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <h2 className="border-b p-4 font-semibold text-foreground">{title}</h2>
        {children}
      </CardContent>
    </Card>
  )
}

export function RunMaterials({ items, costing, draft }: { items: any[]; costing: RunCosting; draft: boolean }) {
  const t = useTranslations()
  const available = (item: any) => (isService(item.component) ? '—' : formatNumber(Number(item.component?.stock) || 0))
  const name = (item: any) => (
    <>
      {item.component?.name ?? '—'}
      {item.is_fixed && <Tag tone="slate">{t('production.consumption_fixed')}</Tag>}
      {item.is_extra && <Tag tone="amber">{t('production.extraMaterialShort')}</Tag>}
    </>
  )
  return (
    <LinesCard title={t('production.tabMaterials')}>
      <ResponsiveTable
        rows={items}
        numbered={false}
        rowKey={(item) => item.id}
        columns={[
          { key: 'name', header: t('production.component'), className: 'font-medium', cell: name },
          { key: 'qty', header: t('production.required'), align: 'right', className: 'tabular-nums', cell: (i) => `${formatNumber(Number(i.quantity))} ${i.component?.unit ?? ''}` },
          ...(draft
            ? [{ key: 'available', header: t('production.available'), align: 'right' as const, className: 'tabular-nums', cell: (i: any) => <span className={cn(isShortLine(i) && 'font-semibold text-rose-600 dark:text-rose-400')}>{available(i)}</span> }]
            : []),
          { key: 'unit', header: t('production.unitCost'), align: 'right', className: 'tabular-nums', cell: (i) => formatCurrency(costing.unitCostOf(i)) },
          { key: 'total', header: t('common.total'), align: 'right', className: 'font-medium tabular-nums', cell: (i) => formatCurrency(costing.lineTotalOf(i)) },
        ]}
        card={(item) => ({
          title: item.component?.name ?? '—',
          subtitle: `${formatNumber(Number(item.quantity))} ${item.component?.unit ?? ''}`,
          status: item.is_extra ? <Tag tone="amber">{t('production.extraMaterialShort')}</Tag> : undefined,
          stats: [
            ...(draft ? [{ label: t('production.available'), value: available(item), tone: isShortLine(item) ? ('bad' as const) : ('default' as const) }] : []),
            { label: t('production.unitCost'), value: formatCurrency(costing.unitCostOf(item)) },
            { label: t('common.total'), value: formatCurrency(costing.lineTotalOf(item)), tone: 'brand' as const },
          ],
        })}
      />
    </LinesCard>
  )
}

export function RunOutputs({ outputs, costing }: { outputs: any[]; costing: RunCosting }) {
  const t = useTranslations()
  const qty = (o: any) => Number(o.quantity) || 0
  const unitCost = (o: any) => formatCurrency(qty(o) > 0 ? costing.outputTotalOf(o) / qty(o) : 0)
  const share = (o: any) => `${formatNumber(Number(o.cost_share))}%`
  const unitHeader = (
    <>
      {t('production.unitCost')}
      {!costing.actual && <span className="ml-1 font-normal normal-case text-muted-foreground">· {t('production.estimated')}</span>}
    </>
  )
  return (
    <LinesCard title={t('production.tabOutputs')}>
      <ResponsiveTable
        rows={outputs}
        numbered={false}
        rowKey={(o, index) => o.id ?? String(index)}
        columns={[
          { key: 'name', header: t('production.colProduct'), className: 'font-medium', cell: (o) => <>{o.product?.name ?? '—'}{o.is_extra && <Tag tone="amber">{t('production.extraMaterialShort')}</Tag>}</> },
          { key: 'qty', header: t('production.colQuantity'), align: 'right', className: 'tabular-nums', cell: (o) => `${formatNumber(qty(o))} ${o.product?.unit ?? ''}` },
          ...(costing.sharesOn ? [{ key: 'share', header: t('production.colCostShare'), align: 'right' as const, className: 'tabular-nums', cell: share }] : []),
          { key: 'unit', header: unitHeader, align: 'right', className: 'tabular-nums text-violet-600 dark:text-violet-400', cell: unitCost },
          { key: 'total', header: t('common.total'), align: 'right', className: 'font-medium tabular-nums', cell: (o) => formatCurrency(costing.outputTotalOf(o)) },
        ]}
        card={(o) => ({
          title: o.product?.name ?? '—',
          subtitle: `${formatNumber(qty(o))} ${o.product?.unit ?? ''}`,
          stats: [
            ...(costing.sharesOn ? [{ label: t('production.colCostShare'), value: share(o) }] : []),
            { label: t('production.unitCost'), value: unitCost(o) },
            { label: t('common.total'), value: formatCurrency(costing.outputTotalOf(o)), tone: 'brand' as const },
          ],
        })}
      />
    </LinesCard>
  )
}
