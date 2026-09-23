'use client'

export interface ReportKpi {
  label: string
  value: string
  hint?: string
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
 * No icon either. Each tile carried a small grey pictogram in its corner —
 * a coin beside "Revenue", a box beside "Quantity" — which named again, less
 * precisely, what the label underneath it already said. Six of them in a row
 * read as decoration around the figures rather than as anything to look at.
 *
 * `auto-fit` lets the row hold three tiles or seven without a breakpoint per
 * count.
 */
export function ReportKpis({ items }: { items: ReportKpi[] }) {
  if (items.length === 0) return null

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {item.label}
          </p>
          <p className="mt-2 truncate text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
            {item.value}
          </p>
          {item.hint && (
            <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
              {item.hint}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
