'use client'

import { Ban, PackageCheck, Pencil, Trash2, Truck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useCan } from '@/components/providers/permissions-provider'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import type { RowAction } from '@/components/shared/row-actions-menu'
import { businessRpcErrorMessage } from '@/lib/business-rpc'
import { invalidateDelivery } from '@/lib/data/revalidate'
import { distributionErrorMessage, setDeliveryStatus } from '@/lib/distribution-actions'
import { useRowAction } from '@/lib/hooks/use-row-action'
import type { DeliveryStatus } from '@/lib/statuses'
import { createClient } from '@/lib/supabase/client'
import { isoDate } from '@/lib/utils'

/** The delivery row's actions; a status move also moves the sale behind it, and the toast says so. */
export function useDeliveryActions(lang: string, canEdit: boolean) {
  const t = useTranslations()
  const canDelete = useCan('distribution', 'delete', 'deliveries')
  const [confirm, confirmDialog] = useConfirmDelete()
  const { busyId, run } = useRowAction(invalidateDelivery)

  const move = (delivery: any, next: DeliveryStatus) =>
    run(delivery.id, async () => {
      try {
        const result = await setDeliveryStatus(createClient(), delivery.id, next, isoDate())
        const followed = result.order_status ? t('distribution.orderFollowed', { status: t(`sales.status.${result.order_status}`) }) : undefined
        toast.success(t('distribution.statusChanged'), { description: followed ?? (delivery.order_id ? t('distribution.orderUnchanged') : undefined) })
        await invalidateDelivery()
      } catch (error) {
        toast.error(distributionErrorMessage(t, error, (e) => businessRpcErrorMessage(t, e)))
      }
      return null
    })

  const cancel = async (delivery: any) => {
    if (await confirm({ title: t('distribution.cancelDelivery'), description: t('distribution.cancelDeliveryConfirm'), name: delivery.delivery_number })) await move(delivery, 'cancelled')
  }

  // A delivered parcel is the record that it arrived: it is never deleted, only cancelled.
  const remove = async (delivery: any) => {
    if (!(await confirm({ name: delivery.delivery_number }))) return
    await run(delivery.id, async () => {
      const { error } = await (createClient() as any).from('deliveries').delete().eq('id', delivery.id)
      if (error) throw error
      return t('common.success')
    })
  }

  const actionsFor = (delivery: any): RowAction[] => {
    const busy = busyId === delivery.id
    const open = delivery.status === 'pending' || delivery.status === 'in_transit'
    return [
      { key: 'transit', label: t('distribution.markInTransit'), icon: Truck, onClick: () => move(delivery, 'in_transit'), disabled: busy, hidden: !canEdit || delivery.status !== 'pending' },
      { key: 'deliver', label: t('distribution.markDelivered'), icon: PackageCheck, onClick: () => move(delivery, 'delivered'), disabled: busy, hidden: !canEdit || delivery.status !== 'in_transit' },
      { key: 'edit', label: t('common.edit'), icon: Pencil, href: `/${lang}/distribution/deliveries/${delivery.id}/edit`, hidden: !canEdit || !open },
      { key: 'cancel', label: t('common.cancel'), icon: Ban, onClick: () => cancel(delivery), disabled: busy, hidden: !canEdit || !open },
      { key: 'delete', label: t('common.delete'), icon: Trash2, onClick: () => remove(delivery), disabled: busy, destructive: true, hidden: !canDelete || delivery.status === 'delivered' },
    ]
  }

  return { actionsFor, confirmDialog }
}
