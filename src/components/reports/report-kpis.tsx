'use client'

import type { LucideIcon } from 'lucide-react'

export interface ReportKpi {
  label: string
  value: string
  hint?: string
  /** Optional: a tile reads fine without one, and profit is shown without. */
  icon?: LucideIcon
}

/**
 * The KPI row used by every report.
 *
 * One tone for every tile, on purpose. The previous overview gave each metric
 * its own colour — emerald revenue, violet profit, amber quantity, rose
 * warnings — which made a row of six read as six unrelated statuses instead of
 * one summary. Colour now means something (it is used for the chart series and
 * for the ABC classes) precisely because it is not sprayed across the figures.
 *
 * `auto-fit` lets the row hold three tiles or seven without a breakpoint per
 * count.
 */
export function ReportKpis({ items }: { items: ReportKpi[] }) {
  if (items.length === 0) return null

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {item.label}
              </p>
              {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />}
            </div>
            <p className="mt-2 truncate text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
              {item.value}
            </p>
            {item.hint && (
              <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                {item.hint}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
