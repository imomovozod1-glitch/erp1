'use client'

import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NumericInput } from '@/components/ui/numeric-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NameSelect } from '@/components/shared/name-select'
import { unitAllowsDecimals } from '@/lib/units'
import { cn, formatCurrency } from '@/lib/utils'
import type { PurchaseLine } from './purchase-lines'
import type { PurchaseFormState } from './use-purchase-form'

interface LineProps {
  line: PurchaseLine
  index: number
  form: PurchaseFormState
  compact?: boolean
}

function ProductName({ line, index, form }: LineProps) {
  const t = useTranslations('procurement')
  if (line.productId) return <>{line.productName}</>
  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <span className="text-xs font-semibold text-rose-500">{t('scan.unmatchedProduct', { name: line.productName })}</span>
      <NameSelect value="" onChange={(id) => form.matchLine(index, id)} options={form.products} placeholder={`${t('selectProduct')}...`} triggerClassName="border-rose-300 dark:border-rose-800" />
    </div>
  )
}

function useLineInputs({ line, index, form, compact }: LineProps) {
  const t = useTranslations('procurement')
  const unit = form.products.find((p) => p.id === line.productId)?.unit
  const input = (field: 'quantity' | 'unitCost', decimals = true) => (
    <NumericInput
      value={line[field]}
      allowDecimals={decimals}
      onChange={(value) => form.changeLine(index, { [field]: Number(value) || 0 })}
      className={cn('text-right', compact && 'h-8')}
    />
  )
  if (compact) return { quantity: input('quantity', unitAllowsDecimals(unit)), cost: input('unitCost') }
  return {
    quantity: (
      <label className="space-y-1 text-xs text-muted-foreground">
        {t('quantity')}
        {input('quantity', unitAllowsDecimals(unit))}
      </label>
    ),
    cost: (
      <label className="space-y-1 text-xs text-muted-foreground">
        {t('unitCost')}
        {input('unitCost')}
      </label>
    ),
  }
}

function RemoveButton({ index, form, compact }: Omit<LineProps, 'line'>) {
  const t = useTranslations('common')
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t('delete')}
      onClick={() => form.remove(index)}
      className={cn('shrink-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30', compact ? 'size-7' : '-mt-1 -mr-1 size-10')}
    >
      <Trash2 className={compact ? 'size-3.5' : 'size-4'} />
    </Button>
  )
}

function LineCard(props: LineProps) {
  const t = useTranslations('procurement')
  const inputs = useLineInputs(props)
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 text-sm font-semibold break-words">
          <ProductName {...props} />
        </div>
        <RemoveButton index={props.index} form={props.form} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {inputs.quantity}
        {inputs.cost}
      </div>
      <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
        <span className="text-muted-foreground">{t('totalCost')}</span>
        <span className="font-bold tabular-nums">{formatCurrency(props.line.totalCost)}</span>
      </div>
    </div>
  )
}

function LineRow(props: LineProps) {
  const inputs = useLineInputs({ ...props, compact: true })
  return (
    <TableRow>
      <TableCell className="text-center text-xs text-muted-foreground">{props.index + 1}</TableCell>
      <TableCell className="font-medium">
        <ProductName {...props} />
      </TableCell>
      <TableCell>
        <div className="ml-auto w-24">{inputs.quantity}</div>
      </TableCell>
      <TableCell>
        <div className="ml-auto w-32">{inputs.cost}</div>
      </TableCell>
      <TableCell className="text-right font-semibold">{formatCurrency(props.line.totalCost)}</TableCell>
      <TableCell>
        <RemoveButton index={props.index} form={props.form} compact />
      </TableCell>
    </TableRow>
  )
}

export function PurchaseLinesTable({ form }: { form: PurchaseFormState }) {
  const t = useTranslations()
  if (!form.lines.length) return null
  const key = (line: PurchaseLine, index: number) => line.productId || `scan-${index}`
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <div className="space-y-3 p-3 md:hidden">
          {form.lines.map((line, index) => (
            <LineCard key={key(line, index)} line={line} index={index} form={form} />
          ))}
          <div className="flex items-center justify-between rounded-2xl bg-violet-50 px-4 py-3 dark:bg-violet-950/40">
            <span className="text-sm font-semibold">{t('common.total')}</span>
            <span className="text-lg font-black text-violet-700 tabular-nums dark:text-violet-300">{formatCurrency(form.total)}</span>
          </div>
        </div>
        <Table containerClassName="max-md:hidden">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>{t('procurement.product')}</TableHead>
              <TableHead className="text-right">{t('procurement.quantity')}</TableHead>
              <TableHead className="text-right">{t('procurement.unitCost')}</TableHead>
              <TableHead className="text-right">{t('procurement.totalCost')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {form.lines.map((line, index) => (
              <LineRow key={key(line, index)} line={line} index={index} form={form} />
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
      </CardContent>
    </Card>
  )
}
