'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Factory, Pencil, Play, Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber, formatDate, isoDate } from '@/lib/utils'
import { invalidateProduction } from '@/lib/data/revalidate'
import { completeProductionOrder, cancelProductionOrder, productionErrorMessage } from '@/lib/production-actions'
import { businessRpcErrorMessage } from '@/lib/business-rpc'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isService } from '@/lib/product-kind'

const STATUS_TONE = {
  draft: 'amber',
  completed: 'emerald',
  cancelled: 'rose',
} as const

interface ProductionOrderDetailProps {
  order: any
  items: any[]
  lang: string
  canEdit: boolean
}

/**
 * One production run.
 *
 * A draft is still a plan — it shows what it WILL consume and flags anything
 * there is not enough of. Completing it is the only thing on this page that
 * touches stock, and it goes through `complete_production_order`, so the
 * whole run either happens or does not.
 */
export function ProductionOrderDetail({ order, items, lang, canEdit }: ProductionOrderDetailProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('production')
  const tRoot = useTranslations()
  const [confirmCancel, confirmDialog] = useConfirmDelete()
  const [completeOpen, setCompleteOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const isDraft = order.status === 'draft'
  const isCompleted = order.status === 'completed'

  // A draft's figures are what today's cost prices suggest; a finished run
  // carries what it actually cost, written by the database function.
  const estimatedCost = items.reduce(
    (sum, item) => sum + (Number(item.component?.cost_price) || 0) * Number(item.quantity),
    0
  ) + (Number(order.extra_cost) || 0)

  const shortages = items.filter(
    (item) => !isService(item.component) && (Number(item.component?.stock) || 0) < Number(item.quantity)
  )

  const handleComplete = async () => {
    setCompleteOpen(false)
    setIsBusy(true)
    try {
      const result = await completeProductionOrder(createClient(), order.id, isoDate())
      toast.success(t('completed', { cost: formatCurrency(Number(result.unit_cost) || 0) }))
      await invalidateProduction()
    } catch (error) {
      toast.error(productionErrorMessage(tRoot, error, (e) => businessRpcErrorMessage(tRoot, e)))
    } finally {
      setIsBusy(false)
    }
  }

  const handleCancel = async () => {
    const confirmed = await confirmCancel({
      title: t('cancelTitle'),
      description: isCompleted ? t('cancelConfirm') : undefined,
      name: order.order_number,
    })
    if (!confirmed) return
    setIsBusy(true)
    try {
      await cancelProductionOrder(createClient(), order.id)
      toast.success(t('cancelled'))
      await invalidateProduction()
    } catch (error) {
      toast.error(productionErrorMessage(tRoot, error, (e) => businessRpcErrorMessage(tRoot, e)))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Factory className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {order.product?.name ?? '—'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(Number(order.quantity))} {order.product?.unit} · {order.order_number}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={STATUS_TONE[order.status as keyof typeof STATUS_TONE] ?? 'slate'} label={t(`status_${order.status}`)} />
              {canEdit && isDraft && (
                <>
                  {/* nativeButton={false}: the rendered element is an <a>, and Base UI
                      warns when a button-role component is not a real <button>. */}
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/${lang}/production/orders/${order.id}/edit`} />}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
                  </Button>
                  <Button size="sm" onClick={() => setCompleteOpen(true)} disabled={isBusy}>
                    <Play className="mr-2 h-3.5 w-3.5" /> {t('complete')}
                  </Button>
                </>
              )}
              {canEdit && order.status !== 'cancelled' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isBusy}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  <Ban className="mr-2 h-3.5 w-3.5" /> {tCommon('cancel')}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
            <Field label={t('plannedDate')} value={order.planned_date ? formatDate(order.planned_date) : '—'} />
            <Field label={t('completedAt')} value={order.completed_at ? formatDate(order.completed_at) : '—'} />
            <Field label={t('extraCost')} value={formatCurrency(Number(order.extra_cost) || 0)} />
            <Field label={tCommon('assignedTo')} value={order.assignee?.full_name || tCommon('unassigned')} />
            <Field
              label={t('totalCost')}
              value={formatCurrency(isCompleted ? Number(order.total_cost) || 0 : estimatedCost)}
              hint={isCompleted ? undefined : t('estimated')}
            />
            <Field
              label={t('perUnitCost')}
              value={formatCurrency(
                isCompleted
                  ? Number(order.unit_cost) || 0
                  : Number(order.quantity) > 0
                    ? estimatedCost / Number(order.quantity)
                    : 0
              )}
              hint={isCompleted ? undefined : t('estimated')}
              accent
            />
            {order.bom?.name && <Field label={t('bom')} value={order.bom.name} />}
          </div>

          {order.notes && (
            <p className="border-t pt-4 text-sm text-muted-foreground">{order.notes}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b p-4">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('components')}</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                  <TableHead>{t('component')}</TableHead>
                  <TableHead className="text-right tabular-nums">{t('required')}</TableHead>
                  {isDraft && <TableHead className="text-right tabular-nums">{t('available')}</TableHead>}
                  <TableHead className="text-right tabular-nums">{t('unitCost')}</TableHead>
                  <TableHead className="text-right tabular-nums">{tCommon('total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      {tCommon('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const service = isService(item.component)
                    const available = Number(item.component?.stock) || 0
                    const short = !service && available < Number(item.quantity)
                    // A finished run shows what it was charged; a draft, today's price.
                    const unitCost = isCompleted
                      ? Number(item.unit_cost) || 0
                      : Number(item.component?.cost_price) || 0
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.component?.name ?? '—'}
                          {/* Where the line came from: the composition, or this
                              run's own addition (is_extra). Consumption is
                              identical either way — this only says why it is
                              here. A badge rather than a second table, because
                              the order the components are listed in is still
                              the recipe's. */}
                          {item.is_extra && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              {t('extraMaterialShort')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(Number(item.quantity))} {item.component?.unit}
                        </TableCell>
                        {isDraft && (
                          <TableCell className="text-right tabular-nums">
                            {service ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className={short ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>
                                {formatNumber(available)}
                              </span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right tabular-nums">{formatCurrency(unitCost)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(isCompleted ? Number(item.total_cost) || 0 : unitCost * Number(item.quantity))}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('completeTitle')}</DialogTitle>
            <DialogDescription>{t('completeConfirm')}</DialogDescription>
          </DialogHeader>
          {shortages.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
              <p className="font-medium">{t('notEnough')}</p>
              <ul className="mt-1 space-y-0.5">
                {shortages.map((item) => (
                  <li key={item.id}>
                    {item.component?.name}: {formatNumber(Number(item.component?.stock) || 0)} /{' '}
                    {formatNumber(Number(item.quantity))} {item.component?.unit}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleComplete} disabled={isBusy || shortages.length > 0}>
              {t('complete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  )
}

function Field({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
        {hint && <span className="ml-1 normal-case text-slate-400 dark:text-slate-500">· {hint}</span>}
      </span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          accent ? 'text-violet-600 dark:text-violet-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
