import type { GroupRow } from './aggregate'

export type AbcClass = 'A' | 'B' | 'C'

/**
 * What the ranking is done BY.
 *
 * Revenue answers "what brings the money in", profit answers "what actually
 * earns", quantity answers "what moves off the shelf" — and the three lists
 * genuinely differ: a cheap fast-moving item is an A by units and a C by
 * profit. The step the classic method calls "choose the indicator" is this.
 */
export type AbcMetric = 'revenue' | 'profit' | 'quantity'

export const ABC_METRICS: AbcMetric[] = ['revenue', 'profit', 'quantity']

export function abcMetricValue(row: GroupRow, metric: AbcMetric): number {
  if (metric === 'profit') return row.profit
  if (metric === 'quantity') return row.quantity
  return row.revenue
}

export interface AbcRow extends GroupRow {
  /** The value the ranking was done by — revenue, profit or units sold. */
  metricValue: number
  /** This row's share of the metric total, in percent. */
  metricShare: number
  /** Running share of the metric total, including this row. */
  cumulativeShare: number
  abc: AbcClass
}

/** Cut-offs on the cumulative curve. The classic 80/95 Pareto split. */
export const ABC_THRESHOLDS = { a: 80, b: 95 } as const

/**
 * The four steps of an ABC analysis, in order: take the chosen indicator,
 * rank the rows by it from highest to lowest, work out each row's share and
 * the running (cumulative) share, then cut the list at 80% and 95% — the rows
 * making the first 80% are A, up to 95% are B, the tail is C.
 *
 * The class is decided by the cumulative share *before* the row, so the item
 * that carries the total past 80% is still an A — it is part of what earns
 * that 80%, and excluding it is the classic off-by-one that drops a shop's
 * second-best seller into the B pile.
 *
 * Only positive values count toward the total. Under the `profit` metric a
 * loss-making product has a negative value, and letting that shrink the
 * denominator would push everyone else's share above 100%; such rows rank last
 * and land in C, which is exactly where a product that loses money belongs.
 */
export function classifyAbc(rows: GroupRow[], metric: AbcMetric = 'revenue'): AbcRow[] {
  const ranked = [...rows].sort(
    (a, b) => abcMetricValue(b, metric) - abcMetricValue(a, metric)
  )
  const total = ranked.reduce((sum, r) => sum + Math.max(0, abcMetricValue(r, metric)), 0)

  let running = 0
  return ranked.map((row) => {
    const metricValue = abcMetricValue(row, metric)
    const previousShare = total > 0 ? (running / total) * 100 : 0
    running += Math.max(0, metricValue)
    const abc: AbcClass =
      metricValue <= 0
        ? 'C'
        : previousShare < ABC_THRESHOLDS.a
          ? 'A'
          : previousShare < ABC_THRESHOLDS.b
            ? 'B'
            : 'C'
    return {
      ...row,
      metricValue,
      metricShare: total > 0 ? (metricValue / total) * 100 : 0,
      cumulativeShare: total > 0 ? (running / total) * 100 : 0,
      abc,
    }
  })
}
