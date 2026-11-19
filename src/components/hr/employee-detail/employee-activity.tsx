'use client'

import { DollarSign, ShoppingCart, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { DetailTabs } from '@/components/shared/detail-page'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/shared/responsive-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { orderStatusTone } from '@/lib/statuses'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { PeriodState } from './use-period'

function PeriodSummary({ period, label, paid }: { period: PeriodState; label: string; paid: number }) {
  const t = useTranslations()
  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 p-4 text-xs font-medium text-muted-foreground">
      <span>
        {t('hr.detail.period')}: <span className="font-semibold text-foreground">{label}</span>
      </span>
      {period.period !== 'all' && (
        <Button variant="ghost" size="sm" onClick={period.reset} className="h-9 gap-1 px-2 text-xs md:h-7">
          <X className="size-3.5" />
          {t('common.clear')}
        </Button>
      )}
      <span className="ml-auto">
        {t('common.total')}: <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(paid)}</span>
      </span>
    </div>
  )
}

function PayoutsTable({ rows }: { rows: any[] }) {
  const t = useTranslations()
  const columns: ResponsiveColumn<any>[] = [
    { key: 'category', header: t('common.category'), cell: (tx) => <span className="font-semibold">{tx.category}</span> },
    { key: 'amount', header: t('common.amount'), align: 'right', cell: (tx) => <span className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(tx.amount)}</span> },
    { key: 'note', header: t('hr.detail.note'), cell: (tx) => <span className="text-sm text-muted-foreground">{tx.description || '—'}</span> },
    { key: 'date', header: t('common.date'), cell: (tx) => <span className="text-xs text-muted-foreground">{formatDateTime(tx.created_at)}</span> },
  ]
  return (
    <ResponsiveTable
      rows={rows}
      rowKey={(tx) => tx.id}
      columns={columns}
      card={(tx) => ({
        eyebrow: <span>{formatDateTime(tx.created_at)}</span>,
        title: tx.category,
        subtitle: tx.description || undefined,
        stats: [{ label: t('common.amount'), value: `-${formatCurrency(tx.amount)}`, tone: 'bad' }],
      })}
    />
  )
}

function SalesTable({ rows }: { rows: any[] }) {
  const t = useTranslations()
  const status = (o: any) => <StatusBadge tone={orderStatusTone(o.status)} label={t(`sales.status.${o.status}`)} />
  const columns: ResponsiveColumn<any>[] = [
    { key: 'code', header: t('hr.detail.saleCode'), cell: (o) => <span className="font-semibold">{o.order_number}</span> },
    { key: 'customer', header: t('sales.customer'), cell: (o) => o.customers?.name ?? '—' },
    { key: 'amount', header: t('common.amount'), align: 'right', cell: (o) => <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(o.total_amount)}</span> },
    { key: 'status', header: t('common.status'), cell: status },
    { key: 'date', header: t('common.date'), cell: (o) => <span className="text-xs text-muted-foreground">{formatDateTime(o.created_at)}</span> },
  ]
  return (
    <ResponsiveTable
      rows={rows}
      rowKey={(o) => o.id}
      columns={columns}
      card={(o) => ({
        eyebrow: <span>{formatDateTime(o.created_at)}</span>,
        title: o.order_number,
        subtitle: o.customers?.name ?? undefined,
        status: status(o),
        stats: [{ label: t('common.amount'), value: formatCurrency(o.total_amount), tone: 'good' }],
      })}
    />
  )
}

interface EmployeeActivityProps {
  period: PeriodState
  periodLabel: string
  transactions: any[]
  salesOrders: any[]
  paid: number
}

export function EmployeeActivity({ period, periodLabel, transactions, salesOrders, paid }: EmployeeActivityProps) {
  const t = useTranslations('hr.detail')
  return (
    <DetailTabs
      className="lg:col-span-2"
      tabs={[
        {
          key: 'payouts',
          icon: DollarSign,
          label: t('payoutHistory'),
          content: (
            <>
              <PeriodSummary period={period} label={periodLabel} paid={paid} />
              <PayoutsTable rows={transactions} />
            </>
          ),
        },
        { key: 'sales', icon: ShoppingCart, label: t('salesList'), content: <SalesTable rows={salesOrders} /> },
      ]}
    />
  )
}
