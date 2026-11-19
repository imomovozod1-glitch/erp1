'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Ban, CheckCircle2, FileText, Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MobileChip, MobileThumb } from '@/components/shared/mobile-list'
import { PagedListCard, type PageInfo } from '@/components/shared/paged-list-card'
import { ResponsiveTable } from '@/components/shared/responsive-table'
import { RowActionsMenu, type RowAction } from '@/components/shared/row-actions-menu'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableFilterChips } from '@/components/shared/table-pagination'
import { EmptyCatalog } from '@/components/inventory/catalog/catalog-parts'
import { createClient } from '@/lib/supabase/client'
import { invalidateInvoices } from '@/lib/data/revalidate'
import { failureMessage } from '@/lib/failure-message'
import { effectiveInvoiceStatus, invoiceStatusTone, nextInvoiceStatuses } from '@/lib/statuses'
import { setInvoiceStatus } from '@/lib/status-actions'
import { formatCurrency, formatDateTime } from '@/lib/utils'

interface InvoicesTableProps extends PageInfo {
  invoices: any[]
  lang: string
  status: string
  canEdit: boolean
}

const FILTERS = ['all', 'sent', 'overdue', 'paid', 'cancelled'] as const
const isOpen = (invoice: any) => invoice.status !== 'paid' && invoice.status !== 'cancelled'

function useInvoiceStatus() {
  const t = useTranslations()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const change = async (invoiceId: string, next: string) => {
    if (pendingId) return
    setPendingId(invoiceId)
    try {
      await setInvoiceStatus(createClient(), invoiceId, next as any)
      await invalidateInvoices()
      toast.success(t('common.statusUpdated'))
    } catch (error) {
      toast.error(failureMessage(t, error, t('common.error')))
    } finally {
      setPendingId(null)
    }
  }
  return { pendingId, change }
}

export function InvoicesTable({ invoices, lang, status, canEdit, ...pageInfo }: InvoicesTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const statusChange = useInvoiceStatus()
  const collectHref = (inv: any) => `/${lang}/finance/cashbox?action=kirim&type=debt_collection&customerId=${inv.customer_id}`
  const badge = (inv: any) => {
    const effective = effectiveInvoiceStatus(inv)
    return <StatusBadge tone={invoiceStatusTone(effective)} label={t(`sales.status.${effective}`)} />
  }

  // `paid` is never offered here: money must be received through the invoice page or the cashbox.
  const actionsOf = (inv: any): RowAction[] => [
    { key: 'edit', label: t('common.edit'), icon: Pencil, href: `/${lang}/sales/invoices/${inv.id}/edit`, hidden: !canEdit },
    { key: 'collect', label: t('sales.acceptPayment'), icon: CheckCircle2, href: collectHref(inv), hidden: !isOpen(inv) },
    ...nextInvoiceStatuses(effectiveInvoiceStatus(inv))
      .filter((next) => canEdit && next !== 'paid')
      .map((next) => ({
        key: next,
        label: t('common.markAs', { status: t(`sales.status.${next}`) }),
        icon: next === 'cancelled' ? Ban : ArrowRight,
        onClick: () => statusChange.change(inv.id, next),
        disabled: statusChange.pendingId === inv.id,
        destructive: next === 'cancelled',
      })),
  ]
  const menu = (inv: any) => <RowActionsMenu actions={actionsOf(inv)} />
  const filters = FILTERS.map((value) => ({ value, label: value === 'all' ? t('common.all') : t(`sales.status.${value}`) }))

  return (
    <PagedListCard pageInfo={pageInfo} filters={<TableFilterChips param="status" value={status} options={filters} />}>
      <ResponsiveTable
        rows={invoices}
        rowKey={(inv) => inv.id}
        indexOffset={(pageInfo.page - 1) * pageInfo.pageSize}
        onRowClick={(inv) => router.push(`/${lang}/sales/invoices/${inv.id}`)}
        empty={<EmptyCatalog icon={FileText} />}
        columns={[
          { key: 'number', header: t('sales.invoiceNumber'), className: 'w-45', cell: (inv) => <InvoiceNumber invoice={inv} /> },
          { key: 'customer', header: t('sales.customer'), className: 'font-medium', cell: (inv) => inv.customers?.name || '-' },
          { key: 'total', header: t('common.total'), align: 'right', className: 'font-medium tabular-nums', cell: (inv) => formatCurrency(inv.total_amount) },
          { key: 'paid', header: t('sales.paidAmount'), align: 'right', className: 'text-muted-foreground tabular-nums', cell: (inv) => formatCurrency(inv.paid_amount) },
          { key: 'date', header: t('common.date'), align: 'right', className: 'text-muted-foreground', cell: (inv) => formatDateTime(inv.created_at) },
          {
            key: 'status',
            header: t('common.status'),
            isolated: true,
            cell: (inv) => (
              <div className="flex flex-col items-start gap-1.5">
                {badge(inv)}
                {isOpen(inv) && inv.customer_id && (
                  <Button variant="outline" size="sm" onClick={() => router.push(collectHref(inv))} className="h-7 rounded-md px-2 text-[10px] font-medium text-violet-700 dark:text-violet-400">
                    {t('sales.acceptPayment')}
                  </Button>
                )}
              </div>
            ),
          },
          { key: 'assignee', header: t('common.assignedTo'), className: 'text-muted-foreground max-lg:hidden', cell: (inv) => inv.assignee?.full_name || t('common.unassigned') },
          { key: 'creator', header: t('common.createdBy'), className: 'text-muted-foreground max-xl:hidden', cell: (inv) => inv.creator?.full_name || '—' },
          { key: 'menu', header: '', className: 'w-12', isolated: true, cell: menu },
        ]}
        card={(inv) => ({
          leading: <MobileThumb fallback={<FileText />} />,
          eyebrow: (
            <>
              <MobileChip>{inv.invoice_number}</MobileChip>
              {inv.sales_orders?.order_number && <span className="truncate">{inv.sales_orders.order_number}</span>}
            </>
          ),
          title: inv.customers?.name || '-',
          status: badge(inv),
          menu: menu(inv),
          stats: [
            { label: t('common.total'), value: formatCurrency(inv.total_amount), tone: 'brand' },
            { label: t('sales.paidAmount'), value: formatCurrency(inv.paid_amount), tone: 'good' },
            { label: t('common.date'), value: formatDateTime(inv.created_at) },
          ],
        })}
      />
    </PagedListCard>
  )
}

function InvoiceNumber({ invoice }: { invoice: any }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-violet-600 dark:text-violet-400">
        <FileText className="size-4" />
      </span>
      <div>
        <div className="font-medium text-foreground">{invoice.invoice_number}</div>
        {invoice.sales_orders?.order_number && <div className="text-xs text-muted-foreground">Ord: {invoice.sales_orders.order_number}</div>}
      </div>
    </div>
  )
}
