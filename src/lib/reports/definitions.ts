/**
 * Shape of the custom report builder: which data sources exist, how each may
 * be grouped, and what a result row looks like.
 *
 * Client-safe on purpose — the builder UI and the API route that runs the
 * query both read from here, so a source can never offer a grouping the engine
 * doesn't implement.
 */

export const REPORT_SOURCES = ['sales', 'purchases', 'finance', 'inventory', 'movements'] as const
export type ReportSource = (typeof REPORT_SOURCES)[number]

export const REPORT_GROUPINGS = [
  'none',
  'day',
  'month',
  'product',
  'category',
  'customer',
  'supplier',
  'type',
] as const
export type ReportGrouping = (typeof REPORT_GROUPINGS)[number]

/** Groupings each source supports; the first entry is the default. */
export const SOURCE_GROUPINGS: Record<ReportSource, ReportGrouping[]> = {
  sales: ['none', 'day', 'month', 'product', 'category', 'customer'],
  purchases: ['none', 'day', 'month', 'product', 'supplier'],
  finance: ['none', 'day', 'month', 'category', 'type'],
  // A stock snapshot has no time axis — it is what the warehouse holds now.
  inventory: ['none', 'category'],
  movements: ['none', 'day', 'product', 'type'],
}

/** Sources whose rows carry a date, i.e. where the period selector applies. */
export const DATED_SOURCES: ReportSource[] = ['sales', 'purchases', 'finance', 'movements']

export type ColumnType = 'text' | 'number' | 'money' | 'date'

export interface ReportColumn {
  /** Stable id; the UI translates it as `reports.col.<key>`. */
  key: string
  type: ColumnType
}

export interface ReportResult {
  columns: ReportColumn[]
  rows: Record<string, string | number | null>[]
  /** Column-wise totals for the numeric columns, keyed the same as a row. */
  totals: Record<string, number>
  /** True when the row cap was hit and the result is only part of the data. */
  truncated: boolean
}

/** Hard cap on returned rows — a report is for reading, not for dumping a table. */
export const REPORT_ROW_LIMIT = 5000

export interface ReportRequest {
  source: ReportSource
  groupBy: ReportGrouping
  /** ISO dates (yyyy-mm-dd); ignored by undated sources. */
  from?: string
  to?: string
  /** Free-text match on the row's main name column. */
  search?: string
}
