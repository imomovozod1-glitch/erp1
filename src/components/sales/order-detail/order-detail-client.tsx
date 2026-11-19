'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Ban, Calendar, FileText, Pencil, ShoppingBag, Truck, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { CancelSaleDialog } from '@/components/sales/cancel-sale-dialog'
import { createClient } from '@/lib/supabase/client'
import { errorMessage } from '@/lib/error-message'
import { DELIVERY_STATUS_TONES, orderStatusTone, type DeliveryStatus } from '@/lib/statuses'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { DocumentInfoCard, InfoItem, PageLoader, SaleItemsCard } from '../document-detail/document-parts'
import { fetchOrderData, translateOrderNotes } from './order-data'

type OrderData = Awaited<ReturnType<typeof fetchOrderData>>

function useOrder(id: string, lang: string) {
  const t = useTranslations()
  const router = useRouter()
  const [data, setData] = useState<OrderData | null>(null)
  const fail = useEffectEvent((error: unknown) => {
    toast.error(errorMessage(t, error, t('common.error')))
    router.push(`/${lang}/sales/orders`)
  })

  useEffect(() => {
    let cancelled = false
    fetchOrderData(createClient(), id)
      .then((loaded) => !cancelled && setData(loaded))
      .catch(fail)
    return () => {
      cancelled = true
    }
  }, [id])
  const markCancelled = () => setData((current) => current && { ...current, order: { ...current.order, status: 'cancelled' } })
  return { data, markCancelled }
}

function DeliveryInfo({ delivery, lang }: { delivery: any; lang: string }) {
  const t = useTranslations('distribution')
  return (
    <InfoItem icon={Truck} label={t('delivery')}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/${lang}/distribution/deliveries/${delivery.id}`} className="transition-colors hover:text-violet-600 dark:hover:text-violet-400">
          {delivery.delivery_number}
        </Link>
        <StatusBadge tone={DELIVERY_STATUS_TONES[delivery.status as DeliveryStatus] ?? 'slate'} label={t(`status_${delivery.status}`)} />
      </div>
      {delivery.agent?.full_name && <p className="text-xs font-normal text-muted-foreground">{delivery.agent.full_name}</p>}
    </InfoItem>
  )
}

export function OrderDetailClient({ id, lang }: { id: string; lang: string }) {
  const t = useTranslations()
  const router = useRouter()
  const { data, markCancelled } = useOrder(id, lang)
  const [cancelOpen, setCancelOpen] = useState(false)
  if (!data) return <PageLoader />
  const { order, items, delivery, canEdit, canCancel } = data
  const active = order.status !== 'cancelled'
  const action = 'h-10 w-full gap-2 text-xs md:h-9 md:w-auto'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${t('sales.orders')}: ${order.order_number}`}
        breadcrumbs={[
          { label: 'Falco', href: `/${lang}/dashboard` },
          { label: t('sales.orders'), href: `/${lang}/sales/orders` },
          { label: order.order_number },
        ]}
      />
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <Button variant="outline" onClick={() => router.push(`/${lang}/sales/orders`)} className={action}>
          <ArrowLeft className="size-4" />
          {t('common.back')}
        </Button>
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row md:w-auto">
          {active && canCancel && (
            <Button variant="outline" onClick={() => setCancelOpen(true)} className={cn(action, 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40')}>
              <Ban className="size-4" />
              {t('sales.cancelSale')}
            </Button>
          )}
          {active && canEdit && (
            <Button onClick={() => router.push(`/${lang}/sales/orders/${order.id}/edit`)} className={action}>
              <Pencil className="size-4" />
              {t('common.edit')}
            </Button>
          )}
        </div>
      </div>
      <CancelSaleDialog order={order} open={cancelOpen} onOpenChange={setCancelOpen} onCancelled={markCancelled} />
      <div className="grid gap-6 md:grid-cols-3">
        <DocumentInfoCard icon={ShoppingBag} title={t('sales.orderInfo')}>
          <InfoItem icon={User} label={t('sales.customer')}>
            {order.customers?.name ?? '—'}
          </InfoItem>
          <InfoItem icon={Calendar} label={t('sales.orderDate')}>
            {formatDateTime(order.created_at)}
          </InfoItem>
          <InfoItem icon={FileText} label={t('common.status')}>
            <StatusBadge tone={orderStatusTone(order.status)} label={t(`sales.status.${order.status}`)} />
          </InfoItem>
          {delivery && <DeliveryInfo delivery={delivery} lang={lang} />}
          <InfoItem label={t('common.totalAmount')}>
            <span className="text-lg font-black text-violet-600 dark:text-violet-400">{formatCurrency(order.total_amount)}</span>
          </InfoItem>
          {order.notes && (
            <div className="border-t pt-3">
              <InfoItem icon={FileText} label={t('common.notes')}>
                <p className="text-xs leading-relaxed font-normal whitespace-pre-wrap text-muted-foreground">{translateOrderNotes(order.notes, t)}</p>
              </InfoItem>
            </div>
          )}
        </DocumentInfoCard>
        <SaleItemsCard items={items} />
      </div>
    </div>
  )
}
