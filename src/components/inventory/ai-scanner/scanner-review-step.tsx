'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ScannedItem } from './scan-image'
import type { StockScanner } from './use-stock-scanner'

type TextField = 'name' | 'sku' | 'unit'
type NumberField = 'stock' | 'price' | 'cost_price'

const TEXT_FIELDS: TextField[] = ['name', 'sku', 'unit']
const NUMBER_FIELDS: NumberField[] = ['stock', 'price', 'cost_price']
const LABEL_KEY: Record<TextField | NumberField, string> = {
  name: 'productName',
  sku: 'sku',
  unit: 'unit',
  stock: 'quantity',
  price: 'price',
  cost_price: 'costPrice',
}

interface LineProps {
  item: ScannedItem
  scanner: StockScanner
}

function LineInput({ item, scanner, field, className }: LineProps & { field: TextField | NumberField; className?: string }) {
  const t = useTranslations('inventory')
  const numeric = (NUMBER_FIELDS as string[]).includes(field)
  return (
    <Input
      type={numeric ? 'number' : 'text'}
      value={item[field] ?? ''}
      aria-label={t(LABEL_KEY[field])}
      placeholder={field === 'sku' ? 'SKU-001' : t(LABEL_KEY[field])}
      onChange={(e) => scanner.updateItem(item.id, { [field]: numeric ? Number(e.target.value) : e.target.value })}
      className={cn('h-8 text-xs max-md:h-10', numeric && 'text-right', field === 'sku' && 'font-mono', className)}
    />
  )
}

function RemoveButton({ item, scanner }: LineProps) {
  const t = useTranslations('common')
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t('delete')}
      onClick={() => scanner.removeItem(item.id)}
      className="size-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}

export function ScannerReviewStep({ scanner }: { scanner: StockScanner }) {
  const t = useTranslations('inventory.aiScanner')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
            {t('detected', { count: scanner.items.length })}
          </Badge>
          <span className="text-xs text-muted-foreground max-sm:hidden">{t('editHint')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={scanner.addItem} className="gap-1 text-xs">
            <Plus className="size-3.5" /> {t('addRow')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => scanner.setStep('upload')} className="text-xs text-muted-foreground">
            {t('scanAgain')}
          </Button>
        </div>
      </div>
      <ReviewTable scanner={scanner} />
      <div className="space-y-2.5 md:hidden">
        {scanner.items.map((item, index) => (
          <ReviewCard key={item.id} item={item} index={index} scanner={scanner} />
        ))}
      </div>
    </div>
  )
}

function ReviewTable({ scanner }: { scanner: StockScanner }) {
  const t = useTranslations('inventory')
  return (
    <div className="max-h-100 overflow-y-auto rounded-xl border bg-card max-md:hidden">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow>
            <TableHead className="w-10 text-center">#</TableHead>
            {[...TEXT_FIELDS, ...NUMBER_FIELDS].map((field) => (
              <TableHead key={field} className={cn((NUMBER_FIELDS as string[]).includes(field) && 'text-right')}>
                {t(LABEL_KEY[field])}
              </TableHead>
            ))}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {scanner.items.map((item, index) => (
            <TableRow key={item.id}>
              <TableCell className="text-center text-xs text-muted-foreground">{index + 1}</TableCell>
              {[...TEXT_FIELDS, ...NUMBER_FIELDS].map((field) => (
                <TableCell key={field} className="p-2">
                  <LineInput item={item} scanner={scanner} field={field} />
                </TableCell>
              ))}
              <TableCell className="p-2 text-center">
                <RemoveButton item={item} scanner={scanner} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ReviewCard({ item, index, scanner }: LineProps & { index: number }) {
  const t = useTranslations('inventory')
  return (
    <div className="space-y-2.5 rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
          {index + 1}
        </span>
        <LineInput item={item} scanner={scanner} field="name" className="flex-1" />
        <RemoveButton item={item} scanner={scanner} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LineInput item={item} scanner={scanner} field="sku" />
        <LineInput item={item} scanner={scanner} field="unit" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {NUMBER_FIELDS.map((field) => (
          <label key={field} className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">{t(LABEL_KEY[field])}</span>
            <LineInput item={item} scanner={scanner} field={field} />
          </label>
        ))}
      </div>
    </div>
  )
}
