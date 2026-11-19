'use client'

import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ItemPicker } from '@/components/shared/item-picker'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isService } from '@/lib/product-kind'
import { cn, formatNumber } from '@/lib/utils'
import type { Consumption, LinesMode, LinesProductOption } from './lines-model'

export interface LinesContext {
  mode: LinesMode
  products: LinesProductOption[]
  productOf: (id: string) => LinesProductOption | undefined
  disabled?: boolean
}

export function useLinesContext(mode: LinesMode, products: LinesProductOption[], disabled?: boolean): LinesContext {
  const byId = new Map(products.map((p) => [p.id, p]))
  return { mode, products, productOf: (id) => byId.get(id), disabled }
}

export function stockText(product: LinesProductOption | undefined) {
  return isService(product) ? '—' : formatNumber(Number(product?.stock) || 0)
}

const PILL = 'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold'

export function LineBadges({ mode, isExtra, consumption }: { mode: LinesMode; isExtra: boolean; consumption?: Consumption }) {
  const t = useTranslations('production')
  return (
    <>
      {mode === 'order' && consumption === 'fixed' && (
        <span className={cn(PILL, 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300')}>{t('consumption_fixed')}</span>
      )}
      {isExtra && <span className={cn(PILL, 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300')}>{t('extraMaterialShort')}</span>}
    </>
  )
}

export function RemoveLine({ onClick, disabled, large }: { onClick: () => void; disabled?: boolean; large?: boolean }) {
  const t = useTranslations('common')
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t('delete')}
      disabled={disabled}
      onClick={onClick}
      className={cn('shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30', large ? '-mt-1 -mr-1 size-10' : 'size-8')}
    >
      <Trash2 className={large ? 'size-4' : 'size-3.5'} />
    </Button>
  )
}

export function ConsumptionSelect({ value, onChange, disabled }: { value: Consumption; onChange: (next: Consumption) => void; disabled?: boolean }) {
  const t = useTranslations('production')
  return (
    <Select value={value} disabled={disabled} onValueChange={(next) => onChange((next as Consumption) ?? 'variable')}>
      <SelectTrigger className="h-9 w-full min-w-36" aria-label={t('colConsumption')}>
        <SelectValue>{t(`consumption_${value}`)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="variable">{t('consumption_variable')}</SelectItem>
        <SelectItem value="fixed">{t('consumption_fixed')}</SelectItem>
      </SelectContent>
    </Select>
  )
}

interface AmountInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  compact?: boolean
  label?: string
}

export function AmountInput({ value, onChange, disabled, compact, label }: AmountInputProps) {
  return (
    <NumericInput
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(next) => onChange(Number(next) || 0)}
      className={cn('text-right', compact && 'h-9')}
    />
  )
}

export function LabeledAmount({ label, className, ...input }: AmountInputProps & { label: string; className?: string }) {
  return (
    <label className={cn('space-y-1 text-xs text-muted-foreground', className)}>
      {label}
      <AmountInput {...input} />
    </label>
  )
}

export function EmptyLines({ label }: { label: string }) {
  return <p className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">{label}</p>
}

interface LinePickerProps {
  ctx: LinesContext
  excluded: string[]
  quantityOf: (id: string) => number | null
  onPick: (id: string) => false | void
}

// Both sides take goods only: a service holds no stock, and charged as a material it
// would be counted again as the cashbox expense it usually also is.
export function LinePicker({ ctx, excluded, quantityOf, onPick }: LinePickerProps) {
  const t = useTranslations()
  const options = ctx.products
    .filter((p) => !isService(p) && !excluded.includes(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      meta: `${t('production.available')}: ${formatNumber(Number(p.stock) || 0)} ${p.unit}`,
      badge: quantityOf(p.id),
    }))
  return (
    <ItemPicker
      options={options}
      onPick={(option) => onPick(option.id)}
      placeholder={t('common.search')}
      emptyLabel={t('common.noData')}
      hint={t('production.pickToAddHint')}
      disabled={ctx.disabled}
    />
  )
}
