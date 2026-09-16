'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AlertTriangle, Ban, Loader2, PackageCheck, Undo2, Wallet, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cancelSalesOrder, SaleCancelError } from '@/lib/status-actions'
import { invalidateSale } from '@/lib/data/revalidate'
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

export interface CancelableSale {
  id: string
  order_number?: string | null
  status: string
}

/**
 * Confirmation for cancelling a sale — shared by the order detail page and the
 * orders table, so both reverse a sale the same way (`cancelSalesOrder`) and
 * refresh the same caches afterwards.
 */
export function CancelSaleDialog({
  order,
  open,
  onOpenChange,
  onCancelled,
}: {
  order: CancelableSale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The action already re-renders the current route; this is for client-held state. */
  onCancelled?: () => void
}) {
  const t = useTranslations()
  const [isCancelling, setIsCancelling] = useState(false)

  const effects = [
    { icon: PackageCheck, label: t('sales.cancelSaleEffectStock') },
    { icon: Wallet, label: t('sales.cancelSaleEffectCashbox') },
    { icon: Undo2, label: t('sales.cancelSaleEffectDebt') },
    { icon: UserCheck, label: t('sales.cancelSaleEffectCredit') },
  ]

  const handleConfirm = async () => {
    if (!order || isCancelling) return
    setIsCancelling(true)
    try {
      const supabase = createClient() as any
      const { data: { session } } = await supabase.auth.getSession()
      const result = await cancelSalesOrder(supabase, order, session?.user?.id ?? null)

      // One action: its response also carries the re-rendered current route,
      // so callers need no extra `router.refresh()`.
      await invalidateSale().catch(() => {
        // Only means another page may show stale numbers until its cache window
        // lapses; the cancellation itself is already written.
      })

      const details = [
        result.refunded > 0 &&
          t('sales.cancelSaleRefunded', {
            amount: formatCurrency(result.refunded),
            cashbox: result.cashboxName ?? '',
          }),
        result.creditRestored > 0 &&
          t('sales.cancelSaleCreditRestored', { amount: formatCurrency(result.creditRestored) }),
      ].filter(Boolean)
      toast.success(t('sales.cancelSaleSuccess'), {
        description: details.length > 0 ? details.join('. ') : undefined,
      })

      onOpenChange(false)
      onCancelled?.()
    } catch (error: any) {
      if (error instanceof SaleCancelError) {
        toast.error(
          error.code === 'insufficient_cashbox'
            ? t('sales.cancelSaleInsufficient', {
                cashbox: error.details.cashboxName ?? '—',
                balance: formatCurrency(error.details.balance ?? 0),
                amount: formatCurrency(error.details.amount ?? 0),
              })
            : error.code === 'forbidden'
              ? t('common.noPermission')
              : t('sales.cancelSaleAlreadyCancelled')
        )
        if (error.code === 'already_cancelled') {
          onOpenChange(false)
          onCancelled?.()
        }
      } else {
        toast.error(error?.message || t('common.error'))
      }
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isCancelling && onOpenChange(next)}>
      <DialogContent
        showCloseButton={!isCancelling}
        className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border-0 shadow-xl p-6"
      >
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {t('sales.cancelSaleTitle')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
            {t('sales.cancelSaleDescription', { order: order?.order_number ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {effects.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200"
            >
              <Icon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              {label}
            </li>
          ))}
        </ul>

        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{t('sales.cancelSaleIrreversible')}</p>

        <DialogFooter className="-mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCancelling}>
            {t('sales.cancelSaleKeep')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isCancelling}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            {t('sales.cancelSaleConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
