'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Truck, PackageCheck, Pencil, Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, isoDate } from '@/lib/utils'
import { invalidateDelivery } from '@/lib/data/revalidate'
import { setDeliveryStatus, distributionErrorMessage } from '@/lib/distribution-actions'
import { businessRpcErrorMessage } from '@/lib/business-rpc'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DELIVERY_STATUS_TONES, orderStatusTone, type DeliveryStatus } from '@/lib/statuses'

interface DeliveryDetailProps {
  delivery: any
  lang: string
  canEdit: boolean
}

/**
 * One delivery.
 *
 * The status buttons are the whole point of the page: each one calls
 * `set_delivery_status`, which moves the delivery and the sale behind it
 * together, and the toast reports what happened to both.
 */
export function DeliveryDetail({ delivery, lang, canEdit }: DeliveryDetailProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('distribution')
  const tRoot = useTranslations()
  const [confirmCancel, confirmDialog] = useConfirmDelete()
  const [isBusy, setIsBusy] = useState(false)

  const isPending = delivery.status === 'pending'
  const isInTransit = delivery.status === 'in_transit'
  const isOpen = isPending || isInTransit

  const move = async (next: DeliveryStatus) => {
    setIsBusy(true)
    try {
      const result = await setDeliveryStatus(createClient(), delivery.id, next, isoDate())
      toast.success(t('statusChanged'), {
        description: result.order_status
          ? t('orderFollowed', { status: tRoot(`sales.status.${result.order_status}`) })
          : delivery.order_id
            ? t('orderUnchanged')
            : undefined,
      })
      await invalidateDelivery()
    } catch (error) {
      toast.error(distributionErrorMessage(tRoot, error, (e) => businessRpcErrorMessage(tRoot, e)))
    } finally {
      setIsBusy(false)
    }
  }

  const handleCancel = async () => {
    const confirmed = await confirmCancel({
      title: t('cancelDelivery'),
      description: t('cancelDeliveryConfirm'),
      name: delivery.delivery_number,
    })
    if (!confirmed) return
    await move('cancelled')
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {delivery.customer?.name ?? '—'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {delivery.delivery_number}
                  {delivery.address ? ` · ${delivery.address}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={DELIVERY_STATUS_TONES[delivery.status as DeliveryStatus] ?? 'slate'}
                label={t(`status_${delivery.status}`)}
              />
              {canEdit && isOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/${lang}/distribution/deliveries/${delivery.id}/edit`} />}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
                </Button>
              )}
              {canEdit && isPending && (
                <Button size="sm" onClick={() => move('in_transit')} disabled={isBusy}>
                  <Truck className="mr-2 h-3.5 w-3.5" /> {t('markInTransit')}
                </Button>
              )}
              {canEdit && isInTransit && (
                <Button size="sm" onClick={() => move('delivered')} disabled={isBusy}>
                  <PackageCheck className="mr-2 h-3.5 w-3.5" /> {t('markDelivered')}
                </Button>
              )}
              {canEdit && isOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isBusy}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  <Ban className="mr-2 h-3.5 w-3.5" /> {tCommon('cancel')}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
            <Field label={t('courier')} value={delivery.agent?.full_name || t('noAgent')} />
            <Field label={t('route')} value={delivery.route?.name || '—'} />
            <Field
              label={t('plannedDate')}
              value={delivery.planned_date ? formatDate(delivery.planned_date) : '—'}
            />
            <Field
              label={t('deliveredAt')}
              value={delivery.delivered_at ? formatDate(delivery.delivered_at) : '—'}
            />
            <Field label={tCommon('assignedTo')} value={delivery.assignee?.full_name || tCommon('unassigned')} />
            {delivery.customer?.phone && <Field label={tCommon('phone')} value={delivery.customer.phone} />}
          </div>

          {delivery.order ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('order')}
                </span>
                <Link
                  href={`/${lang}/sales/orders/${delivery.order.id}`}
                  className="font-semibold text-slate-800 transition-colors hover:text-violet-600 dark:text-slate-200 dark:hover:text-violet-400"
                >
                  {delivery.order.order_number}
                </Link>
                <StatusBadge
                  tone={orderStatusTone(delivery.order.status)}
                  label={tRoot(`sales.status.${delivery.order.status}`)}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(Number(delivery.order.total_amount) || 0)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noOrderLink')}</p>
          )}

          {delivery.notes && <p className="border-t pt-4 text-sm text-muted-foreground">{delivery.notes}</p>}
        </CardContent>
      </Card>

      {confirmDialog}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  )
}
