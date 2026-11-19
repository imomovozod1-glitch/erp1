'use client'

import { ShoppingCart, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NumericInput } from '@/components/ui/numeric-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { unitAllowsDecimals } from '@/lib/units'
import { cn, formatCurrency } from '@/lib/utils'
import type { SaleItem } from './sale-lines'
import type { SaleFormState } from './use-sale-form'

interface LineProps {
  item: SaleItem
  index: number
  form: SaleFormState
  compact?: boolean
}

function PriceInput({ item, index, form, compact }: LineProps) {
  return (
    <NumericInput value={item.unitPrice} onChange={(v) => form.changePrice(index, v)} className={cn('text-right', compact && 'h-8')} />
  )
}

function QuantityInput({ item, index, form, compact }: LineProps) {
  return (
    <NumericInput
      value={item.quantity}
      onChange={(v) => form.changeQuantity(index, v)}
      allowDecimals={unitAllowsDecimals(form.productOf(item)?.unit)}
      className={cn('text-right', compact && 'h-8')}
    />
  )
}

function RemoveLine({ index, form, compact }: Omit<LineProps, 'item'>) {
  const t = useTranslations('common')
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t('delete')}
      onClick={() => form.remove(index)}
      className={cn('shrink-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30', compact ? 'size-7' : 'size-10')}
    >
      <Trash2 className={compact ? 'size-3.5' : 'size-4'} />
    </Button>
  )
}

function LineCard(props: LineProps) {
  const t = useTranslations('sales')
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold break-words">{props.item.productName}</p>
        <RemoveLine index={props.index} form={props.form} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          {t('unitPrice')}
          <PriceInput {...props} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          {t('quantity')}
          <QuantityInput {...props} />
        </label>
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
        <span className="text-muted-foreground">{t('totalPrice')}</span>
        <span className="font-bold tabular-nums">{formatCurrency(props.item.totalPrice)}</span>
      </div>
    </div>
  )
}

function LinesDesktop({ form }: { form: SaleFormState }) {
  const t = useTranslations()
  return (
    <Table containerClassName="max-md:hidden">
      <TableHeader>
        <TableRow className="bg-muted/40">
          <TableHead className="w-10 text-center">#</TableHead>
          <TableHead>{t('sales.productName')}</TableHead>
          <TableHead className="text-right">{t('sales.unitPrice')}</TableHead>
          <TableHead className="text-right">{t('sales.quantity')}</TableHead>
          <TableHead className="text-right">{t('sales.totalPrice')}</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {form.items.map((item, index) => (
          <TableRow key={item.productId}>
            <TableCell className="text-center text-xs text-muted-foreground">{index + 1}</TableCell>
            <TableCell className="font-medium">{item.productName}</TableCell>
            <TableCell>
              <div className="ml-auto w-32">
                <PriceInput item={item} index={index} form={form} compact />
              </div>
            </TableCell>
            <TableCell>
              <div className="ml-auto w-24">
                <QuantityInput item={item} index={index} form={form} compact />
              </div>
            </TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(item.totalPrice)}</TableCell>
            <TableCell>
              <RemoveLine index={index} form={form} compact />
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/60 font-semibold">
          <TableCell colSpan={4} className="text-right">
            {t('common.total')}:
          </TableCell>
          <TableCell className="text-right text-lg">{formatCurrency(form.total)}</TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  )
}

export function SaleLinesTable({ form }: { form: SaleFormState }) {
  const t = useTranslations()
  if (!form.items.length) {
    return (
      <Card className="border border-dashed shadow-sm">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <ShoppingCart className="size-8 opacity-40" />
          <p className="text-sm">{t('sales.noItems')}</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <div className="space-y-3 p-3 md:hidden">
          {form.items.map((item, index) => (
            <LineCard key={item.productId} item={item} index={index} form={form} />
          ))}
          <div className="flex items-center justify-between rounded-2xl bg-violet-50 px-4 py-3 dark:bg-violet-950/40">
            <span className="text-sm font-semibold">{t('common.total')}</span>
            <span className="text-lg font-black text-violet-700 tabular-nums dark:text-violet-300">{formatCurrency(form.total)}</span>
          </div>
        </div>
        <LinesDesktop form={form} />
      </CardContent>
    </Card>
  )
}
