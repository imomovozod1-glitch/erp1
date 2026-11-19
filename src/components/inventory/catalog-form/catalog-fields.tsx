'use client'

import { Controller, type Control, type FieldErrors, type FieldValues, type Path } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { LabeledField } from '@/components/shared/labeled-field'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { profitSummary } from './catalog-pricing'

interface ControlledProps<T extends FieldValues> {
  control: Control<T>
  errors: FieldErrors<T>
}

const pathOf = <T extends FieldValues>(name: string) => name as Path<T>

const errorOf = (errors: FieldErrors, name: string) => errors[name]?.message as string | undefined

export function CategoryField<T extends FieldValues>({ control, errors, categories }: ControlledProps<T> & { categories: { id: string; name: string }[] }) {
  const t = useTranslations()
  return (
    <LabeledField id="category_id" label={t('inventory.category')} error={errorOf(errors as FieldErrors, 'category_id')}>
      <Controller
        control={control}
        name={pathOf<T>('category_id')}
        render={({ field }) => (
          <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
            <SelectTrigger id="category_id" className="w-full">
              <SelectValue placeholder={t('common.select')}>
                {categories.find((c) => c.id === field.value)?.name ?? t('common.select')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('common.select')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </LabeledField>
  )
}

export function UnitField<T extends FieldValues>({ control, errors, units }: ControlledProps<T> & { units: string[] }) {
  const t = useTranslations()
  return (
    <LabeledField id="unit" label={t('inventory.unit')} required error={errorOf(errors as FieldErrors, 'unit')}>
      <Controller
        control={control}
        name={pathOf<T>('unit')}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="unit" className="w-full">
              <SelectValue placeholder={t('common.select')} />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </LabeledField>
  )
}

export function StatusField<T extends FieldValues>({ control }: { control: Control<T> }) {
  const t = useTranslations('common')
  return (
    <LabeledField id="is_active" label={t('status')}>
      <Controller
        control={control}
        name={pathOf<T>('is_active')}
        render={({ field }) => (
          <Select value={field.value ? 'true' : 'false'} onValueChange={(value) => field.onChange(value === 'true')}>
            <SelectTrigger id="is_active" className="w-full">
              <SelectValue>{t(field.value ? 'active' : 'inactive')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t('active')}</SelectItem>
              <SelectItem value="false">{t('inactive')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
    </LabeledField>
  )
}

interface AmountFieldProps<T extends FieldValues> extends ControlledProps<T> {
  name: string
  label: string
  hint?: string
  allowDecimals?: boolean
  onAmountChange?: (amount: number) => void
}

export function AmountField<T extends FieldValues>({ control, errors, name, label, hint, allowDecimals, onAmountChange }: AmountFieldProps<T>) {
  return (
    <LabeledField id={name} label={label} error={errorOf(errors as FieldErrors, name)}>
      <Controller
        control={control}
        name={pathOf<T>(name)}
        render={({ field }) => (
          <NumericInput
            id={name}
            value={field.value}
            allowDecimals={allowDecimals}
            onChange={(value) => {
              field.onChange(value)
              onAmountChange?.(Number(value) || 0)
            }}
          />
        )}
      />
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </LabeledField>
  )
}

export function ProfitPanel({ price, cost, note }: { price: number; cost: number; note?: string }) {
  const t = useTranslations('inventory')
  const summary = profitSummary(price, cost)
  if (!summary) return null
  const figures = [
    { label: t('expectedProfit'), value: formatCurrency(summary.profit), tone: summary.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
    { label: t('margin'), value: `${summary.margin.toFixed(1)}%`, tone: 'text-sky-600 dark:text-sky-400' },
    { label: t('markup'), value: `${summary.markup.toFixed(1)}%`, tone: 'text-violet-600 dark:text-violet-400' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/40 p-4 animate-in duration-200 fade-in md:col-span-2">
      <div className="flex flex-wrap gap-8">
        {figures.map((figure) => (
          <div key={figure.label} className="space-y-1">
            <span className="block text-xs font-medium tracking-wider text-muted-foreground uppercase">{figure.label}</span>
            <span className={cn('text-lg font-bold tracking-tight', figure.tone)}>{figure.value}</span>
          </div>
        ))}
      </div>
      {note && <p className="basis-full text-[11px] leading-snug text-muted-foreground">{note}</p>}
    </div>
  )
}
