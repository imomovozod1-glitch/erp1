'use client'

import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils'
import { ManageButtons, MoveButton, typeMetaOf, type CashboxRowActions } from './cashbox-actions'
import type { Cashbox } from './cashbox-types'

interface CashboxMobileListProps extends CashboxRowActions {
  cashboxes: Cashbox[]
  total: number
}

export function CashboxMobileList({ cashboxes, total, ...actions }: CashboxMobileListProps) {
  return (
    <div data-slot="table-container" className="space-y-3 p-3 md:hidden">
      {cashboxes.map((cashbox) => (
        <CashboxMobileCard key={cashbox.id} cashbox={cashbox} {...actions} />
      ))}
      <CashboxTotalStrip count={cashboxes.length} total={total} />
    </div>
  )
}

function CashboxMobileCard({ cashbox, onMove, onEdit, onDelete }: CashboxRowActions & { cashbox: Cashbox }) {
  const tRoot = useTranslations()
  const meta = typeMetaOf(cashbox)
  const TypeIcon = meta.icon
  return (
    <article className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
      <div className="relative bg-brand-gradient p-4 text-white">
        <div className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-white/10" />
        <div className="relative flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <TypeIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate leading-snug font-semibold">{cashbox.name}</h3>
            <span className="text-[10px] font-semibold tracking-wide text-white/75 uppercase">{tRoot(meta.labelKey)}</span>
          </div>
          <div className="flex shrink-0 gap-1">
            <ManageButtons
              cashbox={cashbox}
              onEdit={onEdit}
              onDelete={onDelete}
              buttonClassName="size-10 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white"
            />
          </div>
        </div>
        <p className="relative mt-4 text-[11px] text-white/70">{tRoot('finance.balance')}</p>
        <p className="relative truncate text-2xl font-extrabold tabular-nums">{formatCurrency(cashbox.balance)}</p>
        {cashbox.description && <p className="relative mt-1 truncate text-xs text-white/70">{cashbox.description}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <MoveButton cashbox={cashbox} type="income" onMove={onMove} className="h-11" />
        <MoveButton cashbox={cashbox} type="expense" onMove={onMove} className="h-11" />
      </div>
    </article>
  )
}

function CashboxTotalStrip({ count, total }: { count: number; total: number }) {
  const t = useTranslations('finance')
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-violet-50 px-4 py-3 dark:bg-violet-500/15">
      <div className="min-w-0">
        <p className="text-sm font-bold">{t('totalBalance')}</p>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase">{t('cashboxCount', { count })}</p>
      </div>
      <p className="truncate text-lg font-extrabold text-violet-700 tabular-nums dark:text-violet-300">
        {formatCurrency(total)}
      </p>
    </div>
  )
}
