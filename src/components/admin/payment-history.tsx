'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export interface PaymentRow {
  id: string
  amount: number
  paid_at: string
  created_at: string
  note: string | null
}

export function PaymentHistory({
  tenantId,
  payments,
  totalPaid,
}: {
  tenantId: string
  payments: PaymentRow[]
  totalPaid: number
}) {
  const t = useTranslations('admin.tenants.detail')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [amount, setAmount] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAdd = async () => {
    if (!amount || amount <= 0) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note: note || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('paymentError'))
        setIsSubmitting(false)
        return
      }
      toast.success(t('paymentAdded'))
      setAmount('')
      setNote('')
      router.refresh()
    } catch {
      toast.error(t('paymentError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Wallet className="h-4 w-4 text-indigo-600" />
        {t('totalPaid')}: <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totalPaid)}</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="payment-amount">{t('amount')}</Label>
          <NumericInput
            id="payment-amount"
            placeholder="0"
            value={amount === '' ? undefined : amount}
            onChange={(v) => setAmount(v === '' ? '' : v)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5 flex-1 min-w-40">
          <Label htmlFor="payment-note">{t('note')}</Label>
          <Input id="payment-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button onClick={handleAdd} disabled={isSubmitting || !amount} className="gap-2 bg-indigo-600 hover:bg-indigo-500">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('addPayment')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('amount')}</TableHead>
            <TableHead>{t('note')}</TableHead>
            <TableHead className="text-right">{tCommon('date')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="h-20 text-center text-slate-400">
                {t('noPayments')}
              </TableCell>
            </TableRow>
          ) : (
            payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium tabular-nums">{formatCurrency(p.amount)}</TableCell>
                <TableCell className="text-slate-500">{p.note || '—'}</TableCell>
                <TableCell className="text-right text-slate-500">{formatDateTime(p.created_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
