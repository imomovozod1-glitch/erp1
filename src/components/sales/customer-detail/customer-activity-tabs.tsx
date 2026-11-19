'use client'

import { FileText, History, ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { DetailTabs } from '@/components/shared/detail-page'
import { ResponsiveTable } from '@/components/shared/responsive-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { effectiveInvoiceStatus, invoiceStatusTone, orderStatusTone } from '@/lib/statuses'
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import type { CustomerActivity } from './customer-metrics'

function OrdersTab({ orders, lang }: { orders: any[]; lang: string }) {
  const t = useTranslations()
  const router = useRouter()
  const status = (o: any) => <StatusBadge tone={orderStatusTone(o.status)} label={t(`sales.status.${o.status}`)} />
  return (
    <ResponsiveTable
      rows={orders}
      rowKey={(o) => o.id}
      onRowClick={(o) => router.push(`/${lang}/sales/orders/${o.id}`)}
      columns={[
        { key: 'code', header: t('sales.customerDetail.orderCode'), className: 'font-semibold', cell: (o) => o.order_number },
        { key: 'amount', header: t('common.amount'), align: 'right', className: 'font-bold text-emerald-600 dark:text-emerald-400', cell: (o) => formatCurrency(o.total_amount) },
        { key: 'status', header: t('common.status'), cell: status },
        { key: 'date', header: t('common.date'), className: 'text-xs text-muted-foreground', cell: (o) => formatDateTime(o.created_at) },
      ]}
      card={(o) => ({
        eyebrow: <span>{formatDateTime(o.created_at)}</span>,
        title: o.order_number,
        status: status(o),
        stats: [{ label: t('common.amount'), value: formatCurrency(o.total_amount), tone: 'good' }],
      })}
    />
  )
}

function InvoicesTab({ invoices, lang }: { invoices: any[]; lang: string }) {
  const t = useTranslations()
  const router = useRouter()
  const detail = (key: string) => t(`sales.customerDetail.${key}`)
  const status = (inv: any) => {
    const effective = effectiveInvoiceStatus(inv)
    return <StatusBadge tone={invoiceStatusTone(effective)} label={t(`sales.status.${effective}`)} />
  }
  return (
    <ResponsiveTable
      rows={invoices}
      rowKey={(inv) => inv.id}
      onRowClick={(inv) => router.push(`/${lang}/sales/invoices/${inv.id}`)}
      columns={[
        { key: 'code', header: detail('invoiceCode'), className: 'font-semibold', cell: (inv) => inv.invoice_number },
        { key: 'amount', header: t('common.amount'), align: 'right', className: 'font-bold', cell: (inv) => formatCurrency(inv.total_amount) },
        { key: 'paid', header: detail('paid'), align: 'right', className: 'font-medium text-emerald-600 dark:text-emerald-400', cell: (inv) => formatCurrency(inv.paid_amount) },
        { key: 'status', header: t('common.status'), cell: status },
        { key: 'due', header: detail('due'), className: 'text-xs text-muted-foreground', cell: (inv) => formatDate(inv.due_at) },
      ]}
      card={(inv) => ({
        eyebrow: <span>{detail('due')}: {formatDate(inv.due_at)}</span>,
        title: inv.invoice_number,
        status: status(inv),
        stats: [
          { label: t('common.amount'), value: formatCurrency(inv.total_amount) },
          { label: detail('paid'), value: formatCurrency(inv.paid_amount), tone: 'good' },
        ],
      })}
    />
  )
}

function PaymentsTab({ transactions }: { transactions: any[] }) {
  const t = useTranslations()
  const detail = (key: string) => t(`sales.customerDetail.${key}`)
  const income = (tx: any) => tx.type === 'income'
  const kind = (tx: any) => <StatusBadge tone={income(tx) ? 'emerald' : 'rose'} label={detail(income(tx) ? 'income' : 'expense')} />
  const signed = (tx: any) => `${income(tx) ? '+' : '-'}${formatCurrency(tx.amount)}`
  return (
    <ResponsiveTable
      rows={transactions}
      rowKey={(tx) => tx.id}
      columns={[
        { key: 'type', header: t('common.type'), cell: kind },
        { key: 'category', header: t('common.category'), className: 'text-xs', cell: (tx) => tx.category },
        {
          key: 'amount',
          header: t('common.amount'),
          align: 'right',
          className: 'font-bold',
          cell: (tx) => <span className={cn(income(tx) ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>{signed(tx)}</span>,
        },
        { key: 'date', header: t('common.date'), className: 'text-xs text-muted-foreground', cell: (tx) => formatDateTime(tx.created_at) },
        { key: 'note', header: detail('note'), className: 'max-w-50 truncate text-xs text-muted-foreground', cell: (tx) => tx.description || '—' },
      ]}
      card={(tx) => ({
        eyebrow: <span>{formatDateTime(tx.created_at)}</span>,
        title: tx.category,
        subtitle: tx.description || undefined,
        status: kind(tx),
        stats: [{ label: t('common.amount'), value: signed(tx), tone: income(tx) ? 'good' : 'bad' }],
      })}
    />
  )
}

export function CustomerActivityTabs({ activity, lang }: { activity: CustomerActivity; lang: string }) {
  const t = useTranslations('sales.customerDetail')
  return (
    <DetailTabs
      tabs={[
        { key: 'orders', icon: ShoppingCart, label: t('tabSales'), content: <OrdersTab orders={activity.salesOrders} lang={lang} /> },
        { key: 'invoices', icon: FileText, label: t('tabInvoices'), content: <InvoicesTab invoices={activity.invoices} lang={lang} /> },
        { key: 'payments', icon: History, label: t('tabPayments'), content: <PaymentsTab transactions={activity.transactions} /> },
      ]}
    />
  )
}
