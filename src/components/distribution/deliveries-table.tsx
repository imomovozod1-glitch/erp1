'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Truck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { MobileChip, MobileThumb } from '@/components/shared/mobile-list'
import { PagedListCard, type PageInfo } from '@/components/shared/paged-list-card'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/shared/responsive-table'
import { RowActionsMenu } from '@/components/shared/row-actions-menu'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableFilterChips } from '@/components/shared/table-pagination'
import { EmptyCatalog } from '@/components/inventory/catalog/catalog-parts'
import { useDeliveryActions } from '@/components/distribution/use-delivery-actions'
import { DELIVERY_STATUS_TONES, orderStatusTone, type DeliveryStatus } from '@/lib/statuses'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUSES = ['pending', 'in_transit', 'delivered', 'cancelled'] as const

interface DeliveriesTableProps extends PageInfo {
  deliveries: any[]
  lang: string
  status: 'all' | DeliveryStatus
  canEdit: boolean
}

function useDeliveryCells() {
  const t = useTranslations()
  return {
    status: (d: any) => <StatusBadge tone={DELIVERY_STATUS_TONES[d.status as DeliveryStatus] ?? 'slate'} label={t(`distribution.status_${d.status}`)} />,
    total: (d: any) => (d.order ? formatCurrency(Number(d.order.total_amount) || 0) : '—'),
    planned: (d: any) => (d.planned_date ? formatDate(d.planned_date) : '—'),
    courier: (d: any) => d.agent?.full_name || t('common.unassigned'),
    order: (d: any) =>
      d.order ? (
        <div className="flex items-center gap-2">
          <span className="text-sm">{d.order.order_number}</span>
          <StatusBadge tone={orderStatusTone(d.order.status)} label={t(`sales.status.${d.order.status}`)} />
        </div>
      ) : (
        <span className="text-muted-foreground">{t('distribution.noOrderLink')}</span>
      ),
  }
}

export function DeliveriesTable({ deliveries, lang, status, canEdit, ...pageInfo }: DeliveriesTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const actions = useDeliveryActions(lang, canEdit)
  const cell = useDeliveryCells()
  const detailUrl = (d: any) => `/${lang}/distribution/deliveries/${d.id}`
  const menu = (d: any) => <RowActionsMenu actions={actions.actionsFor(d)} />
  const columns: ResponsiveColumn<any>[] = [
    {
      key: 'number',
      header: t('distribution.deliveryNumber'),
      cell: (d) => (
        <Link href={detailUrl(d)} onClick={(e) => e.stopPropagation()} className="font-semibold text-foreground transition-colors hover:text-violet-600 dark:hover:text-violet-400">
          {d.delivery_number}
        </Link>
      ),
    },
    {
      key: 'customer',
      header: t('distribution.customer'),
      cell: (d) => (
        <div>
          <p>{d.customer?.name ?? '—'}</p>
          {d.address && <p className="max-w-50 truncate text-xs text-muted-foreground">{d.address}</p>}
        </div>
      ),
    },
    { key: 'order', header: t('distribution.order'), className: 'max-lg:hidden', cell: cell.order },
    { key: 'courier', header: t('distribution.courier'), cell: (d) => <span className="text-muted-foreground">{cell.courier(d)}</span> },
    { key: 'planned', header: t('distribution.plannedDate'), cell: (d) => <span className="text-muted-foreground">{cell.planned(d)}</span> },
    { key: 'total', header: t('common.total'), align: 'right', className: 'tabular-nums max-lg:hidden', cell: cell.total },
    { key: 'status', header: t('common.status'), cell: cell.status },
    { key: 'menu', header: '', className: 'w-12', isolated: true, cell: menu },
  ]
  const filters = (
    <TableFilterChips param="status" value={status} options={[{ value: 'all', label: t('common.all') }, ...STATUSES.map((value) => ({ value, label: t(`distribution.status_${value}`) }))]} />
  )
  return (
    <PagedListCard pageInfo={pageInfo} filters={filters}>
      <ResponsiveTable
        rows={deliveries}
        rowKey={(d) => d.id}
        columns={columns}
        indexOffset={(pageInfo.page - 1) * pageInfo.pageSize}
        onRowClick={(d) => router.push(detailUrl(d))}
        empty={<EmptyCatalog icon={Truck} />}
        card={(d) => ({
          leading: <MobileThumb fallback={<Truck />} />,
          eyebrow: (
            <>
              <MobileChip>{d.delivery_number}</MobileChip>
              {d.order?.order_number && <span className="truncate">{d.order.order_number}</span>}
            </>
          ),
          title: d.customer?.name ?? '—',
          subtitle: d.address || undefined,
          status: cell.status(d),
          menu: menu(d),
          stats: [
            { label: t('common.total'), value: cell.total(d), tone: 'brand' },
            { label: t('distribution.plannedDate'), value: cell.planned(d) },
            { label: t('distribution.courier'), value: cell.courier(d) },
          ],
        })}
      />
      {actions.confirmDialog}
    </PagedListCard>
  )
}
