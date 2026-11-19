'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, Factory, Pencil, Play, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useCan } from '@/components/providers/permissions-provider'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { MobileChip, MobileThumb } from '@/components/shared/mobile-list'
import { PagedListCard, type PageInfo } from '@/components/shared/paged-list-card'
import { ResponsiveTable } from '@/components/shared/responsive-table'
import { RowActionsMenu } from '@/components/shared/row-actions-menu'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableFilterChips } from '@/components/shared/table-pagination'
import { EmptyCatalog } from '@/components/inventory/catalog/catalog-parts'
import { createClient } from '@/lib/supabase/client'
import { invalidateProduction } from '@/lib/data/revalidate'
import { businessRpcErrorMessage } from '@/lib/business-rpc'
import { errorMessage } from '@/lib/error-message'
import { cancelProductionOrder, productionErrorMessage } from '@/lib/production-actions'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'
import { RUN_STATUS_TONE } from './order-detail/run-costing'

interface ProductionOrdersTableProps extends PageInfo {
  orders: any[]
  lang: string
  status: 'all' | 'draft' | 'completed' | 'cancelled'
}

const FILTERS = ['all', 'draft', 'completed', 'cancelled'] as const

function useRunRowActions() {
  const t = useTranslations()
  const [confirm, confirmDialog] = useConfirmDelete()
  const [busyId, setBusyId] = useState<string | null>(null)

  const withBusy = async (id: string, action: () => Promise<string>) => {
    setBusyId(id)
    try {
      toast.success(await action())
      await invalidateProduction()
    } catch (error) {
      toast.error(productionErrorMessage(t, error, (e) => businessRpcErrorMessage(t, e)))
    } finally {
      setBusyId(null)
    }
  }

  const cancel = async (order: any) => {
    const description = order.status === 'completed' ? t('production.cancelConfirm') : undefined
    if (!(await confirm({ title: t('production.cancelTitle'), confirmLabel: t('production.cancelRun'), description, name: order.order_number }))) return
    await withBusy(order.id, async () => {
      await cancelProductionOrder(createClient(), order.id)
      return t('production.cancelled')
    })
  }

  // A finished run is the paperwork behind stock movements: it is cancelled, never deleted.
  const remove = async (order: any) => {
    if (order.status === 'completed') return void toast.error(t('production.cannotDeleteCompleted'))
    if (!(await confirm({ name: order.order_number }))) return
    await withBusy(order.id, async () => {
      const { error } = await createClient().from('production_orders').delete().eq('id', order.id)
      if (error) throw new Error(errorMessage(t, error, t('common.error')))
      return t('common.success')
    })
  }

  return { busyId, cancel, remove, confirmDialog }
}

export function ProductionOrdersTable({ orders, lang, status, ...pageInfo }: ProductionOrdersTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const canEdit = useCan('production', 'edit', 'orders')
  const canDelete = useCan('production', 'delete', 'orders')
  const actions = useRunRowActions()
  const href = (o: any) => `/${lang}/production/orders/${o.id}`
  const done = (o: any) => o.status === 'completed'
  const money = (o: any, key: 'total_cost' | 'unit_cost') => (done(o) ? formatCurrency(Number(o[key]) || 0) : '—')
  const quantity = (o: any) => `${formatNumber(Number(o.quantity) || 0)} ${o.product?.unit ?? ''}`
  const more = (o: any) => ((o.outputs?.length ?? 0) > 1 ? t('production.moreOutputs', { count: o.outputs.length - 1 }) : '')
  const badge = (o: any) => <StatusBadge tone={RUN_STATUS_TONE[o.status as keyof typeof RUN_STATUS_TONE] ?? 'slate'} label={t(`production.status_${o.status}`)} />
  const menu = (o: any) => {
    const draft = o.status === 'draft'
    return (
      <RowActionsMenu
        actions={[
          { key: 'edit', label: t('common.edit'), icon: Pencil, href: `${href(o)}/edit`, hidden: !canEdit || !draft },
          { key: 'complete', label: t('production.complete'), icon: Play, href: href(o), hidden: !canEdit || !draft },
          { key: 'cancel', label: t('common.cancel'), icon: Ban, onClick: () => actions.cancel(o), disabled: actions.busyId === o.id, hidden: !canEdit || o.status === 'cancelled' },
          { key: 'delete', label: t('common.delete'), icon: Trash2, onClick: () => actions.remove(o), disabled: actions.busyId === o.id, destructive: true, hidden: !canDelete || done(o) },
        ]}
      />
    )
  }
  const filters = FILTERS.map((value) => ({ value, label: value === 'all' ? t('common.all') : t(`production.status_${value}`) }))

  return (
    <>
      <PagedListCard pageInfo={pageInfo} filters={<TableFilterChips param="status" value={status} options={filters} />}>
        <ResponsiveTable
          rows={orders}
          rowKey={(o) => o.id}
          indexOffset={(pageInfo.page - 1) * pageInfo.pageSize}
          onRowClick={(o) => router.push(href(o))}
          empty={<EmptyCatalog icon={Factory} />}
          columns={[
            { key: 'number', header: t('production.orderNumber'), cell: (o) => <Link href={href(o)} className="font-semibold text-foreground hover:text-violet-600 dark:hover:text-violet-400">{o.order_number}</Link> },
            { key: 'product', header: t('production.finishedProduct'), cell: (o) => <>{o.product?.name ?? '—'}{more(o) && <span className="ml-1.5 text-xs text-muted-foreground">{more(o)}</span>}</> },
            { key: 'qty', header: t('common.quantity'), align: 'right', className: 'tabular-nums', cell: quantity },
            { key: 'date', header: t('production.plannedDate'), className: 'text-muted-foreground', cell: (o) => (o.planned_date ? formatDate(o.planned_date) : '—') },
            { key: 'total', header: t('production.totalCost'), align: 'right', className: 'tabular-nums max-lg:hidden', cell: (o) => money(o, 'total_cost') },
            { key: 'unit', header: t('production.unitCost'), align: 'right', className: 'font-semibold text-violet-600 tabular-nums dark:text-violet-400 max-lg:hidden', cell: (o) => money(o, 'unit_cost') },
            { key: 'assignee', header: t('common.assignedTo'), className: 'text-muted-foreground max-lg:hidden', cell: (o) => o.assignee?.full_name || t('common.unassigned') },
            { key: 'status', header: t('common.status'), cell: badge },
            { key: 'menu', header: '', className: 'w-12', isolated: true, cell: menu },
          ]}
          card={(o) => ({
            leading: <MobileThumb fallback={<Factory />} />,
            eyebrow: (
              <>
                <MobileChip>{o.order_number}</MobileChip>
                {o.planned_date && <span className="truncate">{formatDate(o.planned_date)}</span>}
              </>
            ),
            title: `${o.product?.name ?? '—'}${more(o) ? ` ${more(o)}` : ''}`,
            status: badge(o),
            menu: menu(o),
            stats: [
              { label: t('common.quantity'), value: quantity(o), tone: 'brand' },
              { label: t('production.totalCost'), value: money(o, 'total_cost') },
              { label: t('production.unitCost'), value: money(o, 'unit_cost') },
            ],
          })}
        />
      </PagedListCard>
      {actions.confirmDialog}
    </>
  )
}
