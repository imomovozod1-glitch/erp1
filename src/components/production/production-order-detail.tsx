'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatNumber } from '@/lib/utils'
import { isShortLine, runCosting } from './order-detail/run-costing'
import { RunHeader } from './order-detail/run-header'
import { RunMaterials, RunOutputs } from './order-detail/run-lines'
import { useRunActions } from './order-detail/use-run-actions'

interface ProductionOrderDetailProps {
  order: any
  items: any[]
  outputs: any[]
  lang: string
  canEdit: boolean
}

interface CompleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortages: any[]
  busy: boolean
  onConfirm: () => void
}

function CompleteRunDialog({ open, onOpenChange, shortages, busy, onConfirm }: CompleteDialogProps) {
  const t = useTranslations()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('production.completeTitle')}</DialogTitle>
          <DialogDescription>{t('production.completeConfirm')}</DialogDescription>
        </DialogHeader>
        {shortages.length > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
            <p className="font-medium">{t('production.notEnough')}</p>
            <ul className="mt-1 space-y-0.5">
              {shortages.map((item) => (
                <li key={item.id}>
                  {item.component?.name}: {formatNumber(Number(item.component?.stock) || 0)} / {formatNumber(Number(item.quantity))} {item.component?.unit}
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={busy || shortages.length > 0}>
            {t('production.complete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One production run. A draft is a plan that flags what it is short of; completing it
 * is the only stock-moving step here and runs through `complete_production_order`.
 */
export function ProductionOrderDetail({ order, items, outputs, lang, canEdit }: ProductionOrderDetailProps) {
  const actions = useRunActions(order)
  const [completeOpen, setCompleteOpen] = useState(false)
  const costing = runCosting(order, items, outputs)
  const complete = () => {
    setCompleteOpen(false)
    actions.complete()
  }

  // A grid, not a stack: the `.app-page` rule stretches a card holding a table to the screen height.
  return (
    <div className="grid gap-6">
      <RunHeader order={order} outputs={outputs} costing={costing} lang={lang} canEdit={canEdit} actions={actions} onComplete={() => setCompleteOpen(true)} />
      <RunMaterials items={items} costing={costing} draft={order.status === 'draft'} />
      <RunOutputs outputs={outputs} costing={costing} />
      <CompleteRunDialog open={completeOpen} onOpenChange={setCompleteOpen} shortages={items.filter(isShortLine)} busy={actions.busy} onConfirm={complete} />
      {actions.confirmDialog}
    </div>
  )
}
