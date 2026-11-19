'use client'

import { Calendar, Landmark, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { ManageButtons, MoveButton, typeMetaOf, type CashboxRowActions } from './cashbox-actions'
import { isMainCashbox, type Cashbox } from './cashbox-types'

interface CashboxTableProps extends CashboxRowActions {
  cashboxes: Cashbox[]
  total: number
}

export function CashboxTable({ cashboxes, total, ...actions }: CashboxTableProps) {
  const t = useTranslations()
  return (
    <Table containerClassName="max-md:hidden">
      <TableHeader>
        <TableRow className="bg-muted/40">
          <TableHead>{t('finance.cashboxName')}</TableHead>
          <TableHead>{t('common.description')}</TableHead>
          <TableHead className="text-right">{t('finance.balance')}</TableHead>
          <TableHead>{t('common.date')}</TableHead>
          <TableHead className="text-right">{t('common.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cashboxes.map((cashbox) => (
          <CashboxRow key={cashbox.id} cashbox={cashbox} {...actions} />
        ))}
      </TableBody>
      <CashboxTableTotal count={cashboxes.length} total={total} />
    </Table>
  )
}

function CashboxRow({ cashbox, onMove, onEdit, onDelete }: CashboxRowActions & { cashbox: Cashbox }) {
  const t = useTranslations()
  return (
    <TableRow className="group transition-colors">
      <TableCell className="font-semibold text-foreground">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'rounded-lg p-1.5',
              isMainCashbox(cashbox) ? 'bg-brand-subtle text-violet-600 dark:text-violet-400' : 'bg-muted text-muted-foreground'
            )}
          >
            <Landmark className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-400">{cashbox.name}</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">{t(typeMetaOf(cashbox).labelKey)}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{cashbox.description || '—'}</TableCell>
      <TableCell className="text-right font-bold text-violet-600 tabular-nums dark:text-violet-400">
        {formatCurrency(cashbox.balance)}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          {formatDateTime(cashbox.created_at)}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <MoveButton cashbox={cashbox} type="income" onMove={onMove} className="h-8 px-3 text-xs" />
          <MoveButton cashbox={cashbox} type="expense" onMove={onMove} className="h-8 px-3 text-xs" />
          <ManageButtons cashbox={cashbox} onEdit={onEdit} onDelete={onDelete} buttonClassName="size-8 text-muted-foreground hover:text-violet-600" />
        </div>
      </TableCell>
    </TableRow>
  )
}

function CashboxTableTotal({ count, total }: { count: number; total: number }) {
  const t = useTranslations('finance')
  return (
    <TableFooter>
      <TableRow>
        <TableCell className="font-bold text-foreground">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-brand-subtle p-1.5 text-violet-600 dark:text-violet-400">
              <Wallet className="size-4" />
            </span>
            <div className="flex flex-col">
              <span>{t('totalBalance')}</span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">{t('cashboxCount', { count })}</span>
            </div>
          </div>
        </TableCell>
        <TableCell />
        <TableCell className="text-right text-lg font-extrabold text-violet-600 tabular-nums dark:text-violet-400">
          {formatCurrency(total)}
        </TableCell>
        <TableCell />
        <TableCell />
      </TableRow>
    </TableFooter>
  )
}
