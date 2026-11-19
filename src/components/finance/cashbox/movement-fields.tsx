'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Textarea } from '@/components/ui/textarea'
import { NameSelect } from '@/components/shared/name-select'
import { cn } from '@/lib/utils'
import type { TransactionCategory } from './cashbox-types'
import type { CashboxMovement } from './use-cashbox-movement'

interface FieldProps {
  id: string
  label: string
  aside?: ReactNode
  children: ReactNode
}

export function Field({ id, label, aside, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
          {label}
        </Label>
        {aside}
      </div>
      {children}
    </div>
  )
}

export type NoteTone = 'emerald' | 'rose' | 'slate'

const NOTE_TONE: Record<NoteTone, string> = {
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
  rose: 'border-rose-100 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300',
  slate: 'border-border/60 bg-muted/60 text-muted-foreground',
}

export function BalanceNote({ tone, label, value }: { tone: NoteTone; label: string; value: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs', NOTE_TONE[tone])}>
      <span className="font-medium">{label}</span>
      <span className="text-sm font-extrabold text-foreground tabular-nums">{value}</span>
    </div>
  )
}

interface CategoryFieldProps {
  movement: CashboxMovement
  categories: TransactionCategory[]
  lang: string
}

export function CategoryField({ movement, categories, lang }: CategoryFieldProps) {
  const t = useTranslations('finance')
  const manageLink = (
    <Link href={`/${lang}/finance/categories`} className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">
      {t('txCategories')}
    </Link>
  )
  return (
    <Field id="tx_category" label={`${t('category')} *`} aside={manageLink}>
      <NameSelect
        id="tx_category"
        value={movement.form.categoryId}
        onChange={movement.chooseCategory}
        options={categories.filter((c) => c.type === movement.form.type)}
        placeholder={t('selectType')}
      />
    </Field>
  )
}

export function MovementDetailsFields({ movement, lang }: { movement: CashboxMovement; lang: string }) {
  const tCommon = useTranslations('common')
  const { form, patchForm } = movement
  return (
    <>
      <Field id="tx_amount" label={`${tCommon('amount')} *`}>
        <NumericInput
          id="tx_amount"
          value={form.amount}
          onChange={(amount) => patchForm({ amount })}
          placeholder="0.00"
          required
          autoFocus
          className="rounded-xl text-lg font-extrabold"
        />
      </Field>
      <Field id="tx_date" label={`${tCommon('date')} *`}>
        <DatePicker id="tx_date" value={form.date} onChange={(date: string) => patchForm({ date })} lang={lang} placeholder={tCommon('date')} />
      </Field>
      <Field id="tx_desc" label={tCommon('description')}>
        <Textarea
          id="tx_desc"
          value={form.description}
          onChange={(e) => patchForm({ description: e.target.value })}
          placeholder={tCommon('description')}
          rows={2}
          className="rounded-xl"
        />
      </Field>
    </>
  )
}
