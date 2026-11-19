import type { ChartType } from '@/components/reports/chart-types'
import type { ReportGrouping, ReportSource } from '@/lib/reports/definitions'
import type { FilterRule, SortRule } from '@/lib/reports/view'

export type ViewMode = 'table' | 'chart'

export interface ReportQuery {
  source: ReportSource
  groupBy: ReportGrouping
  from: string
  to: string
  search: string
}

export interface ReportShape {
  hidden: string[]
  /** Added after the first release — older entries simply lack them. */
  filters?: FilterRule[]
  sort?: SortRule | null
  view?: ViewMode
  chartType?: ChartType
  dimension?: string
  measures?: string[]
}

export type SavedReport = { name: string } & ReportQuery & ReportShape

/** Saved report configurations live per browser, like the other small local preferences. */
const SAVED_KEY = 'erp_saved_reports'

export function readSaved(): SavedReport[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Private mode or a full quota: the report still runs, it just isn't remembered. */
export function writeSaved(reports: SavedReport[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(reports))
  } catch {}
}
