'use client'

import Link from 'next/link'
import { Ban, Factory, Pencil, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'
import { RUN_STATUS_TONE, type RunCosting } from './run-costing'
import type { RunActions } from './use-run-actions'

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="block text-xs font-medium tracking-wider break-words text-muted-foreground uppercase">
        {label}
        {hint && <span className="ml-1 normal-case opacity-80">· {hint}</span>}
      </span>
      <span className="text-sm font-semibold break-words text-foreground tabular-nums">{value}</span>
    </div>
  )
}

interface RunHeaderProps {
  order: any
  outputs: any[]
  costing: RunCosting
  lang: string
  canEdit: boolean
  actions: RunActions
  onComplete: () => void
}

function RunTitle({ order, outputs }: Pick<RunHeaderProps, 'order' | 'outputs'>) {
  const t = useTranslations('production')
  const first = outputs[0]
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
        <Factory className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold break-words text-foreground">
          {first?.product?.name ?? order.product?.name ?? '—'}
          {outputs.length > 1 && <span className="ml-2 text-sm font-medium text-muted-foreground">{t('moreOutputs', { count: outputs.length - 1 })}</span>}
        </p>
        <p className="text-sm break-words text-muted-foreground">
          {formatNumber(Number(first?.quantity ?? order.quantity))} {first?.product?.unit ?? order.product?.unit} · {order.order_number}
        </p>
      </div>
    </div>
  )
}

function RunButtons({ order, lang, canEdit, actions, onComplete }: Pick<RunHeaderProps, 'order' | 'lang' | 'canEdit' | 'actions' | 'onComplete'>) {
  const t = useTranslations()
  const draft = order.status === 'draft'
  return (
    <div className="flex w-full flex-wrap items-center gap-2 md:w-auto [&_[data-slot=button]]:max-md:h-10">
      <StatusBadge tone={RUN_STATUS_TONE[order.status as keyof typeof RUN_STATUS_TONE] ?? 'slate'} label={t(`production.status_${order.status}`)} />
      {canEdit && draft && (
        <>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/${lang}/production/orders/${order.id}/edit`} />}>
            <Pencil className="mr-2 size-3.5" /> {t('common.edit')}
          </Button>
          <Button size="sm" onClick={onComplete} disabled={actions.busy}>
            <Play className="mr-2 size-3.5" /> {t('production.complete')}
          </Button>
        </>
      )}
      {canEdit && order.status !== 'cancelled' && (
        <Button
          variant="outline"
          size="sm"
          onClick={actions.cancel}
          disabled={actions.busy}
          className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
        >
          <Ban className="mr-2 size-3.5" /> {t('common.cancel')}
        </Button>
      )}
    </div>
  )
}

export function RunHeader(props: RunHeaderProps) {
  const t = useTranslations()
  const { order, costing } = props
  const hasBom = !!order.bom?.name
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <RunTitle order={order} outputs={props.outputs} />
          <RunButtons {...props} />
        </div>
        <div className="grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
          <Field label={t('production.orderDate')} value={order.planned_date ? formatDate(order.planned_date) : '—'} />
          <Field label={t('production.completedAt')} value={order.completed_at ? formatDate(order.completed_at) : '—'} />
          {Number(order.extra_cost) > 0 && <Field label={t('production.extraCost')} value={formatCurrency(Number(order.extra_cost))} />}
          <Field label={t('common.assignedTo')} value={order.assignee?.full_name || t('common.unassigned')} />
          <Field
            label={t('production.totalCost')}
            value={formatCurrency(costing.actual ? Number(order.total_cost) || 0 : costing.estimatedTotal)}
            hint={costing.actual ? undefined : t('production.estimated')}
          />
          {hasBom && <Field label={t('production.bom')} value={order.bom.name} />}
          {hasBom && Number(order.batches) > 0 && <Field label={t('production.batches')} value={formatNumber(Number(order.batches))} />}
        </div>
        {order.notes && <p className="border-t pt-4 text-sm text-muted-foreground">{order.notes}</p>}
      </CardContent>
    </Card>
  )
}
