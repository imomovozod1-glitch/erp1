'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { invalidateProduction } from '@/lib/data/revalidate'
import { businessRpcErrorMessage } from '@/lib/business-rpc'
import { cancelProductionOrder, completeProductionOrder, productionErrorMessage } from '@/lib/production-actions'
import { formatCurrency, isoDate } from '@/lib/utils'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'

export function useRunActions(order: any) {
  const t = useTranslations()
  const [confirmCancel, confirmDialog] = useConfirmDelete()
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    try {
      toast.success(await action())
      await invalidateProduction()
    } catch (error) {
      toast.error(productionErrorMessage(t, error, (e) => businessRpcErrorMessage(t, e)))
    } finally {
      setBusy(false)
    }
  }

  const complete = () =>
    run(async () => {
      const result = await completeProductionOrder(createClient(), order.id, isoDate())
      return t('production.completed', { cost: formatCurrency(Number(result.unit_cost) || 0) })
    })

  const cancel = async () => {
    const confirmed = await confirmCancel({
      title: t('production.cancelTitle'),
      confirmLabel: t('production.cancelRun'),
      description: order.status === 'completed' ? t('production.cancelConfirm') : undefined,
      name: order.order_number,
    })
    if (!confirmed) return
    await run(async () => {
      await cancelProductionOrder(createClient(), order.id)
      return t('production.cancelled')
    })
  }

  return { busy, complete, cancel, confirmDialog }
}

export type RunActions = ReturnType<typeof useRunActions>
