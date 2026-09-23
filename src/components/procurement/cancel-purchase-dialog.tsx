'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AlertTriangle, Ban, Loader2, PackageX, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cancelPurchase, purchaseCancelMessage } from '@/lib/purchase-actions'
import { invalidatePurchase } from '@/lib/data/revalidate'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface CancelablePurchase {
  id: string
  po_number?: string | null
  status: string
}

/**
 * Confirmation for cancelling a purchase — shared by the purchases table and
 * the purchase detail page, so both reverse it the same way and refresh the
 * same caches afterwards. The mirror of CancelSaleDialog.
 */
export function CancelPurchaseDialog({
  purchase,
  open,
  onOpenChange,
  onCancelled,
}: {
  purchase: CancelablePurchase | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The action already re-renders the route; this is for client-held state. */
  onCancelled?: () => void
}) {
  const t = useTranslations()
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = async () => {
    if (!purchase) return
    setIsCancelling(true)
    try {
      const supabase = createClient() as any
      const result = await cancelPurchase(supabase, purchase.id)
      toast.success(
        result.refunded > 0
          ? t('procurement.cancel.doneRefunded', {
              amount: formatCurrency(result.refunded),
              cashbox: result.cashboxName || '—',
            })
          : t('procurement.cancel.done')
      )
      await invalidatePurchase()
      onOpenChange(false)
      onCancelled?.()
    } catch (error) {
      toast.error(purchaseCancelMessage(t, error), { duration: 8000 })
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isCancelling && onOpenChange(next)}>
      <DialogContent
        showCloseButton={!isCancelling}
        className="max-w-md rounded-2xl border-0 bg-white p-6 shadow-xl dark:bg-slate-900"
      >
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {t('procurement.cancel.title')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
            {t('procurement.cancel.description', { number: purchase?.po_number || '—' })}
          </DialogDescription>
        </DialogHeader>

        {/* What it will do, before it does it — the same courtesy the sale
            cancellation extends, because both move stock and money at once. */}
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex items-start gap-2">
            <PackageX className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {t('procurement.cancel.effectStock')}
          </li>
          <li className="flex items-start gap-2">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {t('procurement.cancel.effectMoney')}
          </li>
        </ul>

        <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCancelling}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCancel}
            disabled={isCancelling}
            className="gap-2 bg-rose-600 text-white hover:bg-rose-700"
          >
            {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            {t('procurement.cancel.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
