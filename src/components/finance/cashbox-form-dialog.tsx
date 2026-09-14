'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'

export type CashboxType = 'cash' | 'card' | 'transfer' | 'other'

export interface CashboxFormValues {
  name: string
  type: CashboxType
  description: string
  /** Opening balance. Only meaningful when creating — see the note below. */
  initialBalance: number
}

interface EditableCashbox {
  id: string
  name: string
  balance: number
  type: CashboxType
  description: string
}

/**
 * Create / rename a cashbox.
 *
 * Rendered only while open, and keyed on the cashbox being edited — see the
 * call site. Mounting IS opening, which is what lets the fields seed
 * themselves.
 *
 * Owns its form. `cashbox-client.tsx` was holding these four fields among its
 * own twenty-odd `useState`s, where they read as part of the screen's state
 * even though they exist only while this dialog is open — and had to be reset
 * by hand in two separate "open" handlers.
 *
 * The balance is editable only on creation. Afterwards it may move solely
 * through a categorised kirim/chiqim, which leaves an audit trail; the dialog
 * shows the current figure read-only and says so.
 */
export function CashboxFormDialog({
  onOpenChange,
  cashbox,
  onSubmit,
  isSaving,
  lang,
}: {
  onOpenChange: (open: boolean) => void
  /** The cashbox being edited, or null to create a new one. */
  cashbox: EditableCashbox | null
  onSubmit: (values: CashboxFormValues) => void
  isSaving: boolean
  lang: string
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('finance')

  // Seeded once, at mount. The caller renders this only while the dialog is
  // open and keys it on the cashbox being edited, so opening it is a mount and
  // the fields are always right — no effect syncing props into state, which
  // this project's React Compiler rules forbid anyway.
  const [name, setName] = useState(cashbox?.name ?? '')
  const [type, setType] = useState<CashboxType>(cashbox?.type ?? 'cash')
  const [description, setDescription] = useState(cashbox?.description ?? '')
  const [initialBalance, setInitialBalance] = useState(cashbox ? String(cashbox.balance) : '0')

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault()
    if (isSaving) return
    onSubmit({
      name: name.trim(),
      type,
      description: description.trim(),
      initialBalance: Number(initialBalance) || 0,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-7 relative animate-in zoom-in-95 duration-300 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-xl">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {cashbox
                ? lang === 'uz'
                  ? 'Kassani tahrirlash'
                  : lang === 'ru'
                    ? 'Редактировать кассу'
                    : 'Edit cashbox'
                : t('addCashbox')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {lang === 'uz'
                ? "Kassa ma'lumotlarini kiriting"
                : lang === 'ru'
                  ? 'Введите параметры кассы'
                  : 'Enter the cashbox details'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cb_name" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t('cashboxName')} *
            </Label>
            <Input
              id="cb_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                lang === 'uz'
                  ? "Masalan: Asosiy G'azna"
                  : lang === 'ru'
                    ? 'Например: Основная Касса'
                    : 'e.g. Main Cashbox'
              }
              required
              className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cb_type" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t('cashboxType')} *
            </Label>
            <Select value={type} onValueChange={(val: any) => setType(val || 'cash')}>
              <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-slate-700 focus:ring-violet-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="cash" className="rounded-lg">{t('cashboxTypeCash')}</SelectItem>
                <SelectItem value="card" className="rounded-lg">{t('cashboxTypeCard')}</SelectItem>
                <SelectItem value="transfer" className="rounded-lg">{t('cashboxTypeTransfer')}</SelectItem>
                <SelectItem value="other" className="rounded-lg">{t('cashboxTypeOther')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cashbox ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {lang === 'uz' ? 'Joriy balans' : lang === 'ru' ? 'Текущий баланс' : 'Current balance'}
              </Label>
              <div className="h-9 px-3 flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                {formatCurrency(cashbox.balance)}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug">
                {lang === 'uz'
                  ? 'Balansni o\'zgartirish uchun "Kirim" yoki "Chiqim" tugmasidan foydalaning'
                  : lang === 'ru'
                    ? 'Чтобы изменить баланс, используйте кнопку "Приход" или "Расход"'
                    : 'To change the balance, use the "Income" or "Expense" button'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="cb_balance" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t('initialBalance')}
              </Label>
              <NumericInput
                id="cb_balance"
                value={initialBalance}
                onChange={(val) => setInitialBalance(val.toString())}
                placeholder="0"
                className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cb_desc" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {tCommon('description')}
            </Label>
            <Textarea
              id="cb_desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tCommon('description')}
              rows={3}
              className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-xl h-10 px-4 font-semibold text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 px-5 font-semibold text-xs shadow-sm shadow-violet-500/10 hover:shadow-violet-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? tCommon('saving') : tCommon('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
