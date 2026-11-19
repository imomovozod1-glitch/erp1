'use client'

import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NameSelect } from '@/components/shared/name-select'
import { cn, formatCurrency } from '@/lib/utils'
import type { Cashbox, CashboxPageData } from './cashbox-types'
import { BalanceNote, CategoryField, MovementDetailsFields } from './movement-fields'
import { PersonField } from './movement-person-field'
import type { CashboxMovement } from './use-cashbox-movement'

interface MovementDialogProps {
  movement: CashboxMovement
  snapshot: CashboxPageData
  lang: string
}

export function MovementDialog({ movement, snapshot, lang }: MovementDialogProps) {
  const t = useTranslations()
  const { cashbox, form, saving } = movement
  if (!cashbox) return null
  const income = form.type === 'income'

  return (
    <Dialog open disablePointerDismissal onOpenChange={(open) => !open && movement.close()}>
      <DialogContent initialFocus={() => document.getElementById('tx_amount')} className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-md">
        <MovementHeader movement={movement} cashbox={cashbox} cashboxes={snapshot.cashboxes} />
        <BalanceNote tone="slate" label={t('finance.currentCashboxBalance')} value={formatCurrency(cashbox.balance)} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            movement.submit()
          }}
          className="space-y-4"
        >
          <CategoryField movement={movement} categories={snapshot.categories} lang={lang} />
          <PersonField movement={movement} snapshot={snapshot} />
          <MovementDetailsFields movement={movement} lang={lang} />
          <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl px-6 py-4">
            <Button type="button" variant="outline" onClick={movement.close} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className={income ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-600 text-white hover:bg-rose-700'}
            >
              {t(saving ? 'common.saving' : 'common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface MovementHeaderProps {
  movement: CashboxMovement
  cashbox: Cashbox
  cashboxes: Cashbox[]
}

function MovementHeader({ movement, cashbox, cashboxes }: MovementHeaderProps) {
  const t = useTranslations('finance')
  const income = movement.form.type === 'income'
  const Icon = income ? ArrowUpRight : ArrowDownRight
  const switchable = cashboxes.length > 1
  const switchTo = (id: string) => {
    const next = cashboxes.find((cb) => cb.id === id)
    if (next) movement.setCashbox(next)
  }

  return (
    <DialogHeader className="flex-row items-center gap-3 border-b pr-8 pb-3">
      <span
        className={cn(
          'rounded-xl p-2.5',
          income
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        {switchable ? (
          <NameSelect
            value={cashbox.id}
            onChange={switchTo}
            options={cashboxes}
            placeholder={cashbox.name}
            meta={(cb) => <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(cb.balance)}</span>}
            triggerClassName="h-9 bg-muted/60 text-base font-bold"
          />
        ) : (
          <DialogTitle className="text-base font-bold">{cashbox.name}</DialogTitle>
        )}
        <DialogDescription className={cn('text-xs', switchable && 'mt-1.5 pl-3')}>
          {t(income ? 'registerIncome' : 'registerExpense')}
        </DialogDescription>
      </div>
    </DialogHeader>
  )
}
