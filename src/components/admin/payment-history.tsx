'use client'

import { useTranslations } from 'next-intl'
import { Wallet } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export interface PaymentRow {
  id: string
  amount: number
  paid_at: string
  created_at: string
  note: string | null
}

/**
 * A tenant's payments. New payments are recorded through "Make payment" in the
 * subscription section (TenantPaymentDialog), which also extends the term.
 */
export function PaymentHistory({
  payments,
  totalPaid,
}: {
  payments: PaymentRow[]
  totalPaid: number
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('admin.tenants.detail')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Wallet className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        {t('totalPaid')}: <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totalPaid)}</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead>{t('amount')}</TableHead>
            <TableHead>{t('note')}</TableHead>
            <TableHead className="text-right">{tCommon('date')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-20 text-center text-slate-400 dark:text-slate-500">
                {t('noPayments')}
              </TableCell>
            </TableRow>
          ) : (
            payments.map((p, index) => (
              <TableRow key={p.id}>
                <TableCell className="text-center text-xs text-slate-500 dark:text-slate-400">{index + 1}</TableCell>
                <TableCell className="font-medium tabular-nums">{formatCurrency(p.amount)}</TableCell>
                <TableCell className="text-slate-500 dark:text-slate-400">{p.note || '—'}</TableCell>
                <TableCell className="text-right text-slate-500 dark:text-slate-400">{formatDateTime(p.created_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
