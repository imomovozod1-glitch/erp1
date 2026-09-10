'use client'

import { useTranslations } from 'next-intl'
import { Check, LayoutGrid, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  DEFAULT_METRICS, OVERVIEW_METRICS, SNAPSHOT_METRICS, type MetricId,
} from '@/lib/reports/metrics'
import { OVERVIEW_WIDGETS, type OverviewWidget } from '@/lib/reports/widgets'

/**
 * One place to decide what the overview shows: which KPI figures sit at the
 * top, and which blocks appear underneath.
 *
 * A dialog rather than a popover because there are now two distinct decisions
 * with twelve options between them — that is a settings screen, and a popover
 * that size fights the page it floats over.
 */
export function ReportSettingsDialog({
  open,
  onOpenChange,
  metrics,
  onMetricsChange,
  hiddenWidgets,
  onWidgetsChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  metrics: MetricId[]
  onMetricsChange: (next: MetricId[]) => void
  hiddenWidgets: OverviewWidget[]
  onWidgetsChange: (next: OverviewWidget[]) => void
}) {
  const t = useTranslations('reports')

  const toggleMetric = (id: MetricId) => {
    // Appending keeps selection order, which is also render order — so the
    // reader controls which figure lands first without a drag handle.
    onMetricsChange(
      metrics.includes(id) ? metrics.filter((item) => item !== id) : [...metrics, id]
    )
  }

  const toggleWidget = (id: OverviewWidget, visible: boolean) => {
    onWidgetsChange(visible ? hiddenWidgets.filter((item) => item !== id) : [...hiddenWidgets, id])
  }

  const visibleWidgetCount = OVERVIEW_WIDGETS.length - hiddenWidgets.length

  const resetAll = () => {
    onMetricsChange(DEFAULT_METRICS)
    onWidgetsChange([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('customizeView')}</DialogTitle>
        </DialogHeader>

        {/* ── Metrics ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Sparkles className="h-3.5 w-3.5" />
              {t('metricsSection')}
            </h3>
            <span className="text-xs tabular-nums text-slate-400">
              {metrics.length}/{OVERVIEW_METRICS.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t('metricsHint')}</p>

          <div className="grid gap-2 sm:grid-cols-2">
            {OVERVIEW_METRICS.map((id) => {
              const selected = metrics.includes(id)
              const order = metrics.indexOf(id) + 1
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleMetric(id)}
                  aria-pressed={selected}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                    selected
                      ? 'border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums transition-colors',
                      selected
                        ? 'bg-violet-600 text-white'
                        : 'border border-slate-300 text-transparent dark:border-slate-600'
                    )}
                  >
                    {selected ? order : <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {t(`metric.${id}`)}
                    </span>
                    {SNAPSHOT_METRICS.includes(id) && (
                      <span className="block text-[11px] text-amber-600 dark:text-amber-500">
                        {t('snapshotMetric')}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Blocks ──────────────────────────────────────────────── */}
        <section className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <LayoutGrid className="h-3.5 w-3.5" />
              {t('visibleBlocks')}
            </h3>
            <span className="text-xs tabular-nums text-slate-400">
              {visibleWidgetCount}/{OVERVIEW_WIDGETS.length}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {OVERVIEW_WIDGETS.map((id) => {
              const visible = !hiddenWidgets.includes(id)
              return (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition-colors hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                >
                  <Checkbox
                    checked={visible}
                    // Keep at least one block — an empty overview reads as a
                    // page that failed to load.
                    disabled={visible && visibleWidgetCount === 1}
                    onCheckedChange={(checked) => toggleWidget(id, checked === true)}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{t(`widget.${id}`)}</span>
                </label>
              )
            })}
          </div>
        </section>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={resetAll} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            {t('resetView')}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)} className="bg-violet-600 hover:bg-violet-700">
            {t('done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
