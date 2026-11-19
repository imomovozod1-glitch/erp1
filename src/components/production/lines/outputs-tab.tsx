'use client'

import { useTranslations } from 'next-intl'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatNumber } from '@/lib/utils'
import { AmountInput, EmptyLines, LabeledAmount, LineBadges, RemoveLine, stockText, type LinesContext } from './line-parts'
import { costShareTotal, patchAt, quantityTotal, removeAt, sharesOff100, sharesOn, withShares, type OutputLine } from './lines-model'

interface OutputsTabProps {
  ctx: LinesContext
  outputs: OutputLine[]
  onChange: (next: OutputLine[]) => void
}

interface RowProps extends OutputsTabProps {
  line: OutputLine
  index: number
}

function ShareSwitch({ ctx, outputs, onChange }: OutputsTabProps) {
  const t = useTranslations('production')
  return (
    <span className="inline-flex items-center gap-2">
      {t('colCostShare')}
      <Switch
        checked={sharesOn(outputs)}
        disabled={ctx.disabled || !outputs.length}
        onCheckedChange={(on) => onChange(withShares(outputs, on))}
        aria-label={t('colCostShare')}
      />
    </span>
  )
}

function OutputRow({ ctx, outputs, onChange, line, index }: RowProps) {
  const t = useTranslations('production')
  const product = ctx.productOf(line.productId)
  return (
    <TableRow>
      <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
      <TableCell className="font-medium">
        <span className="flex flex-wrap items-center gap-1.5">
          {product?.name ?? '—'}
          <LineBadges mode={ctx.mode} isExtra={line.isExtra} />
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{t('tabOutputs')}</TableCell>
      <TableCell className="text-muted-foreground">{product?.unit}</TableCell>
      {ctx.mode === 'order' && <TableCell className="text-right tabular-nums">{stockText(product)}</TableCell>}
      <TableCell>
        <AmountInput
          compact
          label={t('colCostShare')}
          value={line.costShare ?? 100}
          disabled={ctx.disabled || !sharesOn(outputs)}
          onChange={(costShare) => onChange(patchAt(outputs, index, { costShare }))}
        />
      </TableCell>
      <TableCell>
        <AmountInput compact value={line.quantity} disabled={ctx.disabled} onChange={(quantity) => onChange(patchAt(outputs, index, { quantity }))} />
      </TableCell>
      <TableCell>
        <RemoveLine disabled={ctx.disabled} onClick={() => onChange(removeAt(outputs, index))} />
      </TableCell>
    </TableRow>
  )
}

function OutputCard({ ctx, outputs, onChange, line, index }: RowProps) {
  const t = useTranslations('production')
  const product = ctx.productOf(line.productId)
  const shares = sharesOn(outputs)
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words">
            {index + 1}. {product?.name ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground">
            {product?.unit}
            {ctx.mode === 'order' && ` · ${t('colStock')}: ${stockText(product)}`}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <LineBadges mode={ctx.mode} isExtra={line.isExtra} />
          </div>
        </div>
        <RemoveLine large disabled={ctx.disabled} onClick={() => onChange(removeAt(outputs, index))} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {shares && (
          <LabeledAmount label={t('colCostShare')} value={line.costShare ?? 0} disabled={ctx.disabled} onChange={(costShare) => onChange(patchAt(outputs, index, { costShare }))} />
        )}
        <LabeledAmount
          label={t('colQuantity')}
          className={shares ? undefined : 'col-span-2'}
          value={line.quantity}
          disabled={ctx.disabled}
          onChange={(quantity) => onChange(patchAt(outputs, index, { quantity }))}
        />
      </div>
    </div>
  )
}

function OutputsTotalRow({ ctx, outputs }: OutputsTabProps) {
  const t = useTranslations('common')
  const shares = sharesOn(outputs)
  if (!outputs.length || (ctx.mode !== 'order' && !shares)) return null
  return (
    <TableRow className="bg-muted/60 font-semibold">
      <TableCell />
      <TableCell colSpan={ctx.mode === 'order' ? 4 : 3}>{t('total')}</TableCell>
      <TableCell className={cn('tabular-nums', shares && sharesOff100(outputs) && 'text-rose-600 dark:text-rose-400')}>
        {shares ? `${formatNumber(costShareTotal(outputs))}%` : ''}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(quantityTotal(outputs))}</TableCell>
      <TableCell />
    </TableRow>
  )
}

export function OutputsTable(props: OutputsTabProps) {
  const t = useTranslations('production')
  const { ctx, outputs } = props
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10">№</TableHead>
              <TableHead>{t('colProduct')}</TableHead>
              <TableHead>{t('colType')}</TableHead>
              <TableHead>{t('colUnit')}</TableHead>
              {ctx.mode === 'order' && <TableHead className="text-right">{t('colStock')}</TableHead>}
              <TableHead className="w-44">
                <ShareSwitch {...props} />
              </TableHead>
              <TableHead className="w-48 text-right">{t('colQuantity')} *</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!outputs.length && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {t('noOutputs')}
                </TableCell>
              </TableRow>
            )}
            {outputs.map((line, index) => (
              <OutputRow key={line.productId} {...props} line={line} index={index} />
            ))}
            <OutputsTotalRow {...props} />
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        <div className="flex items-center justify-between rounded-2xl border bg-card px-3 py-2 text-sm font-medium">
          <ShareSwitch {...props} />
          {sharesOn(outputs) && (
            <span className={cn('tabular-nums', sharesOff100(outputs) ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
              {t('costShareTotal', { sum: formatNumber(costShareTotal(outputs)) })}
            </span>
          )}
        </div>
        {!outputs.length && <EmptyLines label={t('noOutputs')} />}
        {outputs.map((line, index) => (
          <OutputCard key={line.productId} {...props} line={line} index={index} />
        ))}
      </div>
    </>
  )
}
