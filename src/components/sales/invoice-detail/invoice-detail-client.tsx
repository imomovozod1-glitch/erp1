'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, FileText, Loader2, Pencil, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { createClient } from '@/lib/supabase/client'
import { invalidateSale } from '@/lib/data/revalidate'
import { errorMessage } from '@/lib/error-message'
import { failureMessage } from '@/lib/failure-message'
import { effectiveInvoiceStatus, invoiceStatusTone } from '@/lib/statuses'
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { DocumentInfoCard, InfoItem, PageLoader, SaleItemsCard } from '../document-detail/document-parts'
import { acceptInvoicePayment, fetchInvoiceData } from './invoice-data'

type InvoiceData = Awaited<ReturnType<typeof fetchInvoiceData>>

function useInvoice(id: string, lang: string) {
  const t = useTranslations()
  const router = useRouter()
  const [data, setData] = useState<InvoiceData | null>(null)
  const [paying, setPaying] = useState(false)

  const fail = useEffectEvent((error: unknown) => {
    toast.error(errorMessage(t, error, t('common.error')))
    router.push(`/${lang}/sales/invoices`)
  })

  useEffect(() => {
    let cancelled = false
    fetchInvoiceData(createClient(), id)
      .then((loaded) => !cancelled && setData(loaded))
      .catch(fail)
    return () => {
      cancelled = true
    }
  }, [id])

  const pay = async () => {
    if (!data) return
    setPaying(true)
    try {
      const supabase = createClient()
      await acceptInvoicePayment(supabase, data.invoice)
      void invalidateSale().catch(() => {})
      toast.success(t('common.success'))
      setData(await fetchInvoiceData(supabase, id))
    } catch (error) {
      toast.error(failureMessage(t, error, t('common.error')))
    } finally {
      setPaying(false)
    }
  }

  return { data, paying, pay }
}

function AmountLine({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span className={cn('font-bold text-foreground', className)}>{formatCurrency(value)}</span>
    </div>
  )
}

export function InvoiceDetailClient({ id, lang }: { id: string; lang: string }) {
  const t = useTranslations()
  const detail = (key: string) => t(`sales.invoiceDetail.${key}`)
  const router = useRouter()
  const { data, paying, pay } = useInvoice(id, lang)
  if (!data) return <PageLoader />
  const { invoice, items, canEdit } = data
  const unpaid = invoice.status !== 'paid' && invoice.status !== 'cancelled'
  const status = effectiveInvoiceStatus(invoice)
  const action = 'h-10 w-full gap-2 text-xs md:h-9 md:w-auto'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${t('sales.invoices')}: ${invoice.invoice_number}`}
        breadcrumbs={[
          { label: 'Falco', href: `/${lang}/dashboard` },
          { label: t('sales.invoices'), href: `/${lang}/sales/invoices` },
          { label: invoice.invoice_number },
        ]}
      />
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex w-full items-center gap-3 md:w-auto">
          <Button variant="outline" onClick={() => router.push(`/${lang}/sales/invoices`)} className={action}>
            <ArrowLeft className="size-4" />
            {t('common.back')}
          </Button>
          {canEdit && (
            <Button variant="outline" onClick={() => router.push(`/${lang}/sales/invoices/${invoice.id}/edit`)} className={cn(action, 'text-violet-700 dark:text-violet-400')}>
              <Pencil className="size-4" />
              {t('common.edit')}
            </Button>
          )}
        </div>
        {unpaid && (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:gap-3 md:w-auto md:items-center">
            <Button
              variant="outline"
              onClick={() => router.push(`/${lang}/finance/cashbox?action=kirim&type=debt_collection&customerId=${invoice.customer_id}`)}
              className={cn(action, 'text-violet-700 dark:text-violet-400')}
            >
              {detail('payViaCashbox')}
            </Button>
            {canEdit && (
              <Button disabled={paying} onClick={pay} className={cn(action, 'bg-emerald-600 text-white hover:bg-emerald-700')}>
                {paying ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {detail('acceptPaymentQuick')}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <DocumentInfoCard icon={FileText} title={detail('info')}>
          <InfoItem icon={User} label={t('sales.customer')}>
            {invoice.customers?.name ?? '—'}
          </InfoItem>
          {invoice.sales_orders?.order_number && (
            <InfoItem label={detail('linkedOrder')}>
              <button type="button" onClick={() => router.push(`/${lang}/sales/orders/${invoice.order_id}`)} className="text-violet-600 hover:underline dark:text-violet-400">
                {invoice.sales_orders.order_number}
              </button>
            </InfoItem>
          )}
          <InfoItem label={detail('issuedAt')}>{formatDateTime(invoice.created_at)}</InfoItem>
          <InfoItem label={detail('dueAt')}>{formatDate(invoice.due_at)}</InfoItem>
          {invoice.paid_at && (
            <InfoItem label={detail('paidAt')}>
              <span className="text-emerald-700 dark:text-emerald-400">{formatDate(invoice.paid_at)}</span>
            </InfoItem>
          )}
          <InfoItem label={t('common.status')}>
            <StatusBadge tone={invoiceStatusTone(status)} label={t(`sales.status.${status}`)} />
          </InfoItem>
          <div className="space-y-2 border-t pt-3">
            <AmountLine label={detail('totalAmount')} value={invoice.total_amount} />
            <AmountLine label={detail('paidAmount')} value={invoice.paid_amount} className="text-emerald-600 dark:text-emerald-400" />
            <div className="border-t pt-1">
              <AmountLine
                label={detail('remaining')}
                value={Number(invoice.total_amount) - Number(invoice.paid_amount)}
                className={cn('font-black', unpaid && 'text-rose-600 dark:text-rose-400')}
              />
            </div>
          </div>
        </DocumentInfoCard>
        <SaleItemsCard items={items} emptyLabel={detail('noItems')} />
      </div>
    </div>
  )
}
