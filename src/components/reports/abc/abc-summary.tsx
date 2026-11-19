'use client'

import { useTranslations } from 'next-intl'
import { ABC_THRESHOLDS, type AbcClass, type AbcRow } from '@/lib/reports/sales-analytics'
import { cn } from '@/lib/utils'

/** One hue, three steps: a ramp of the brand violet reads "more → less important". */
export const CLASS_STYLES: Record<AbcClass, { chip: string; bar: string }> = {
  A: { chip: 'bg-violet-600 text-white', bar: 'bg-violet-600' },
  B: { chip: 'bg-violet-200 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200', bar: 'bg-violet-300' },
  C: { chip: 'bg-muted text-muted-foreground', bar: 'bg-slate-300 dark:bg-slate-700' },
}

const CLASSES: AbcClass[] = ['A', 'B', 'C']

export interface ClassSummary {
  cls: AbcClass
  count: number
  value: number
  share: number
  countShare: number
}

export function summarise(rows: AbcRow[]): ClassSummary[] {
  const total = rows.reduce((sum, r) => sum + Math.max(0, r.metricValue), 0)
  return CLASSES.map((cls) => {
    const members = rows.filter((r) => r.abc === cls)
    const value = members.reduce((sum, r) => sum + r.metricValue, 0)
    return { cls, count: members.length, value, share: total > 0 ? (value / total) * 100 : 0, countShare: rows.length > 0 ? (members.length / rows.length) * 100 : 0 }
  })
}

export function ClassChip({ cls, className }: { cls: AbcClass; className?: string }) {
  return <span className={cn('inline-flex items-center justify-center font-bold', CLASS_STYLES[cls].chip, className)}>{cls}</span>
}

export function AbcClassCards({ summary, format }: { summary: ClassSummary[]; format: (value: number) => string }) {
  const t = useTranslations('reports.abc')
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {summary.map((group) => (
        <div key={group.cls} className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <ClassChip cls={group.cls} className="size-7 rounded-lg text-sm" />
            <span className="text-[11px] text-muted-foreground">{t(`rule.${group.cls}`)}</span>
          </div>
          <p className="mt-3 text-xl font-bold text-foreground tabular-nums">{format(group.value)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('groupSummary', { count: group.count, countShare: group.countShare.toFixed(0), share: group.share.toFixed(1) })}
          </p>
        </div>
      ))}
    </div>
  )
}

/** The whole split in one bar; width is the share of PRODUCTS, so the Pareto shape shows at a glance. */
export function AbcShareBar({ summary }: { summary: ClassSummary[] }) {
  const t = useTranslations('reports.abc')
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {summary
          .filter((group) => group.countShare > 0)
          .map((group) => (
            <span key={group.cls} className={CLASS_STYLES[group.cls].bar} style={{ width: `${group.countShare}%` }} title={`${group.cls}: ${group.count}`} />
          ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t('barHint', { a: ABC_THRESHOLDS.a, b: ABC_THRESHOLDS.b })}</p>
    </div>
  )
}
