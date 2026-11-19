'use client'

import { useTranslations } from 'next-intl'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isService } from '@/lib/product-kind'
import { cn, formatNumber } from '@/lib/utils'
import { AmountInput, ConsumptionSelect, EmptyLines, LabeledAmount, LineBadges, RemoveLine, stockText, type LinesContext } from './line-parts'
import { isShort, patchAt, quantityTotal, removeAt, type MaterialLine } from './lines-model'

interface MaterialsTabProps {
  ctx: LinesContext
  materials: MaterialLine[]
  onChange: (next: MaterialLine[]) => void
}

interface RowProps extends MaterialsTabProps {
  line: MaterialLine
  index: number
}

function useTypeLabel(ctx: LinesContext) {
  const t = useTranslations()
  return (id: string) => (isService(ctx.productOf(id)) ? t('inventory.service') : t('production.typeGoods'))
}

function MaterialRow({ ctx, materials, onChange, line, index }: RowProps) {
  const typeLabel = useTypeLabel(ctx)
  const product = ctx.productOf(line.productId)
  const short = ctx.mode === 'order' && isShort(product, line.quantity)
  return (
    <TableRow>
      <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
      <TableCell className="font-medium">
        <span className="flex flex-wrap items-center gap-1.5">
          {product?.name ?? '—'}
          <LineBadges mode={ctx.mode} isExtra={line.isExtra} consumption={line.consumption} />
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{typeLabel(line.productId)}</TableCell>
      <TableCell className="text-muted-foreground">{product?.unit}</TableCell>
      {ctx.mode === 'bom' && (
        <TableCell>
          <ConsumptionSelect value={line.consumption} disabled={ctx.disabled} onChange={(consumption) => onChange(patchAt(materials, index, { consumption }))} />
        </TableCell>
      )}
      {ctx.mode === 'order' && (
        <TableCell className={cn('text-right tabular-nums', short && 'font-semibold text-rose-600 dark:text-rose-400')}>{stockText(product)}</TableCell>
      )}
      <TableCell>
        <AmountInput compact value={line.quantity} disabled={ctx.disabled} onChange={(quantity) => onChange(patchAt(materials, index, { quantity }))} />
      </TableCell>
      <TableCell>
        <RemoveLine disabled={ctx.disabled} onClick={() => onChange(removeAt(materials, index))} />
      </TableCell>
    </TableRow>
  )
}

function MaterialCard({ ctx, materials, onChange, line, index }: RowProps) {
  const t = useTranslations('production')
  const typeLabel = useTypeLabel(ctx)
  const product = ctx.productOf(line.productId)
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words">
            {index + 1}. {product?.name ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground">
            {typeLabel(line.productId)} · {product?.unit}
            {ctx.mode === 'order' && ` · ${t('colStock')}: ${stockText(product)}`}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <LineBadges mode={ctx.mode} isExtra={line.isExtra} consumption={line.consumption} />
          </div>
        </div>
        <RemoveLine large disabled={ctx.disabled} onClick={() => onChange(removeAt(materials, index))} />
      </div>
      <div className="mt-2 grid gap-2">
        {ctx.mode === 'bom' && (
          <ConsumptionSelect value={line.consumption} disabled={ctx.disabled} onChange={(consumption) => onChange(patchAt(materials, index, { consumption }))} />
        )}
        <LabeledAmount label={t('colQuantity')} value={line.quantity} disabled={ctx.disabled} onChange={(quantity) => onChange(patchAt(materials, index, { quantity }))} />
      </div>
    </div>
  )
}

export function MaterialsTable(props: MaterialsTabProps) {
  const t = useTranslations()
  const { ctx, materials } = props
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10">№</TableHead>
              <TableHead>{t('production.colProduct')}</TableHead>
              <TableHead>{t('production.colType')}</TableHead>
              <TableHead>{t('production.colUnit')}</TableHead>
              {ctx.mode === 'bom' && <TableHead className="w-44">{t('production.colConsumption')}</TableHead>}
              {ctx.mode === 'order' && <TableHead className="text-right">{t('production.colStock')}</TableHead>}
              <TableHead className="w-48 text-right">{t('production.colQuantity')} *</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!materials.length && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {t('production.noComponents')}
                </TableCell>
              </TableRow>
            )}
            {materials.map((line, index) => (
              <MaterialRow key={line.productId} {...props} line={line} index={index} />
            ))}
            {ctx.mode === 'order' && materials.length > 0 && (
              <TableRow className="bg-muted/60 font-semibold">
                <TableCell />
                <TableCell colSpan={3}>{t('common.total')}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{formatNumber(quantityTotal(materials))}</TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {!materials.length && <EmptyLines label={t('production.noComponents')} />}
        {materials.map((line, index) => (
          <MaterialCard key={line.productId} {...props} line={line} index={index} />
        ))}
      </div>
    </>
  )
}
