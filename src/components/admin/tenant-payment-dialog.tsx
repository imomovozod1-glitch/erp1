'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarDays, IdCard, Loader2, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  addMonths,
  DURATION_PRESETS,
  LICENSE_COUNT_PRESETS,
  PresetPicker,
} from '@/components/admin/preset-picker'
import { formatDate, isoDate } from '@/lib/utils'

export interface TenantSubscription {
  id: string
  license_count: number
  license_months: number
  subscription_ends_at: string | null
}

/**
 * "Make payment" on the tenant page: records a payment and extends the
 * subscription by the chosen term (POST /api/admin/tenants/[id]/payments).
 *
 * The term starts from the current end date while the subscription is still
 * running — paying early stacks the new months on top — and from today once
 * it has lapsed. The preview below uses the same rule as the API.
 */
export function TenantPaymentDialog({
  tenant,
  open,
  onOpenChange,
}: {
  tenant: TenantSubscription
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const tForm = useTranslations('admin.form')
  const t = useTranslations('admin.tenants.detail')
  const router = useRouter()
  const [licenseCount, setLicenseCount] = useState(tenant.license_count || 1)
  const [months, setMonths] = useState(tenant.license_months || 1)
  const [amount, setAmount] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const today = isoDate()
  const base = tenant.subscription_ends_at && tenant.subscription_ends_at > today ? tenant.subscription_ends_at : today
  const newEndsAt = addMonths(base, months)

  const handleSubmit = async () => {
    if (!amount || amount <= 0) {
      toast.error(t('amountRequired'))
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          note: note || undefined,
          license_count: licenseCount,
          license_months: months,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || t('paymentError'))
        return
      }
      toast.success(t('paymentAdded'))
      setAmount('')
      setNote('')
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error(t('paymentError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent
        showCloseButton={!isSubmitting}
        className="max-w-lg rounded-2xl border-0 bg-white p-6 shadow-xl dark:bg-slate-900"
      >
        <DialogHeader className="gap-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            <span className="rounded-xl bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
              <Wallet className="h-5 w-5" />
            </span>
            {t('paymentDialogTitle')}
          </DialogTitle>
          <DialogDescription>{t('paymentDialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" /> {tForm('licenseCount')}
            </Label>
            <PresetPicker
              value={licenseCount}
              options={LICENSE_COUNT_PRESETS}
              onSelect={(v) => setLicenseCount(Math.max(1, v))}
              customLabel={tForm('custom')}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <IdCard className="h-3.5 w-3.5 text-muted-foreground" /> {tForm('licenseMonths')}
            </Label>
            <PresetPicker
              value={months}
              options={DURATION_PRESETS}
              onSelect={(v) => setMonths(Math.max(1, v))}
              customLabel={tForm('custom')}
              suffix={tForm('months')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/50">
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> {t('currentEnd')}
              </p>
              <p className="mt-0.5 font-semibold text-slate-700 dark:text-slate-300">
                {tenant.subscription_ends_at ? formatDate(tenant.subscription_ends_at) : '—'}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> {t('newEnd')}
              </p>
              <p className="mt-0.5 font-semibold text-violet-700 dark:text-violet-400">{formatDate(newEndsAt)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tenant-payment-amount">{t('amount')}</Label>
              <NumericInput
                id="tenant-payment-amount"
                placeholder="0"
                value={amount === '' ? undefined : amount}
                onChange={(v) => setAmount(v === '' ? '' : v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenant-payment-note">{t('note')}</Label>
              <Input id="tenant-payment-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {tForm('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !amount}
            className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {t('addPayment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
