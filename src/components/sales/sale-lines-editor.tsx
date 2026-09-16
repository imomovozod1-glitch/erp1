'use client'

import { useTranslations } from 'next-intl'
import { Package, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NumericInput } from '@/components/ui/numeric-input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { saleLineTotal } from '@/lib/sale-edits'

export interface EditableSaleLine {
  id: string
  quantity: number
  unit_price: number
  discount_percent: number | null
  products: { name: string; unit: string | null } | null
}

export interface SaleLineDraft {
  unitPrice: number | ''
  remove: boolean
}

/**
 * The sold products inside the order edit form: change a line's price, or take
 * a line out of the sale. Controlled — `OrderForm` owns the drafts and sends
 * them to `updateSaleLines` on save, which is where stock and money follow.
 */
export function SaleLinesEditor({
  lines,
  drafts,
  onChange,
  newTotal,
  oldTotal,
  disabled,
}: {
  lines: EditableSaleLine[]
  drafts: Record<string, SaleLineDraft>
  onChange: (id: string, patch: Partial<SaleLineDraft>) => void
  newTotal: number
  oldTotal: number
  disabled?: boolean
}) {
  const t = useTranslations()
  const keptCount = lines.filter((line) => !drafts[line.id]?.remove).length
  const difference = newTotal - oldTotal

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">
            <Package className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('sales.soldItems')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t('sales.soldItemsHint')}</p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/30 dark:bg-slate-800/30">
              <TableHead className="font-semibold">{t('sales.productName')}</TableHead>
              <TableHead className="font-semibold text-right">{t('sales.quantity')}</TableHead>
              <TableHead className="font-semibold text-right w-44">{t('sales.unitPrice')}</TableHead>
              <TableHead className="font-semibold text-right">{t('sales.totalPrice')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const draft = drafts[line.id]
              const removed = !!draft?.remove
              const price = draft && draft.unitPrice !== '' ? Number(draft.unitPrice) : Number(line.unit_price)
              const priceChanged = price !== Number(line.unit_price)
              const isLastKept = !removed && keptCount === 1
              return (
                <TableRow
                  key={line.id}
                  className={removed ? 'bg-rose-50/60 dark:bg-rose-950/20' : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/40'}
                >
                  <TableCell className={`font-medium ${removed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                    {line.products?.name ?? '—'}
                    {removed && (
                      <span className="ml-2 no-underline inline-block text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        {t('sales.lineRemoved')}
                      </span>
                    )}
                    {!!line.discount_percent && !removed && (
                      <span className="ml-2 text-[11px] text-muted-foreground">−{formatNumber(line.discount_percent)}%</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${removed ? 'text-slate-400 dark:text-slate-500' : ''}`}>
                    {formatNumber(line.quantity)} {line.products?.unit ?? ''}
                  </TableCell>
                  <TableCell className="text-right">
                    <NumericInput
                      value={draft ? draft.unitPrice : Number(line.unit_price)}
                      onChange={(value) => onChange(line.id, { unitPrice: value })}
                      disabled={disabled || removed}
                      aria-label={t('sales.unitPrice')}
                      className={`h-9 text-right tabular-nums ${priceChanged && !removed ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                    />
                  </TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${removed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                    {formatCurrency(saleLineTotal(price, Number(line.quantity), line.discount_percent))}
                  </TableCell>
                  <TableCell>
                    {removed ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        onClick={() => onChange(line.id, { remove: false })}
                        title={t('sales.restoreLine')}
                        aria-label={t('sales.restoreLine')}
                        className="h-8 w-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        // Taking out the last line would empty the sale — that
                        // is "Cancel sale", which reverses it properly.
                        disabled={disabled || isLastKept}
                        onClick={() => onChange(line.id, { remove: true })}
                        title={isLastKept ? t('sales.noLinesLeft') : t('sales.removeLine')}
                        aria-label={t('sales.removeLine')}
                        className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-sm">
        {difference !== 0 && (
          <span className="text-muted-foreground">
            {t('sales.originalTotal')}: <span className="line-through tabular-nums">{formatCurrency(oldTotal)}</span>
          </span>
        )}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {t('sales.newTotal')}: <span className="text-lg font-black text-violet-600 dark:text-violet-400 tabular-nums">{formatCurrency(newTotal)}</span>
        </span>
        {difference !== 0 && (
          <span className={`text-xs font-semibold tabular-nums ${difference < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {difference > 0 ? '+' : '−'}{formatCurrency(Math.abs(difference))}
          </span>
        )}
      </div>
    </div>
  )
}
