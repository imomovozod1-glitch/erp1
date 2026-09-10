/**
 * Client-side shaping of a report result: filter rules, sorting and the
 * recomputed totals that follow from them.
 *
 * These run in the browser, over the rows the engine already returned, rather
 * than in the SQL — deliberately. The engine caps a result at
 * REPORT_ROW_LIMIT rows and applies the caller's permission scope; re-running
 * a query for every tweak of a filter would make the builder feel like a form
 * submission instead of an exploration tool. The trade-off is real and worth
 * stating: filters narrow *the fetched result*, so on a truncated report they
 * cannot reveal rows beyond the cap. The UI warns when that applies.
 */

import type { ColumnType, ReportColumn } from '@/lib/reports/definitions'

export const FILTER_OPERATORS = [
  'contains',
  'notContains',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
] as const

export type FilterOperator = (typeof FILTER_OPERATORS)[number]

/** Which operators make sense for each column type. First entry is the default. */
export const OPERATORS_BY_TYPE: Record<ColumnType, FilterOperator[]> = {
  text: ['contains', 'notContains', 'eq', 'neq'],
  number: ['gte', 'lte', 'gt', 'lt', 'eq', 'neq'],
  money: ['gte', 'lte', 'gt', 'lt', 'eq', 'neq'],
  // Dates are ISO `yyyy-mm-dd`, so lexicographic order is chronological order.
  date: ['gte', 'lte', 'eq', 'neq'],
}

export interface FilterRule {
  /** Column key this rule applies to. */
  column: string
  operator: FilterOperator
  value: string
}

export interface SortRule {
  column: string
  direction: 'asc' | 'desc'
}

export type ReportRow = Record<string, string | number | null>

function isNumeric(type: ColumnType): boolean {
  return type === 'number' || type === 'money'
}

function testRule(cell: string | number | null, type: ColumnType, rule: FilterRule): boolean {
  const raw = rule.value.trim()
  if (!raw) return true // an unfilled rule filters nothing

  if (isNumeric(type)) {
    const left = Number(cell ?? 0)
    const right = Number(raw)
    if (!Number.isFinite(right)) return true // still being typed
    switch (rule.operator) {
      case 'gt': return left > right
      case 'gte': return left >= right
      case 'lt': return left < right
      case 'lte': return left <= right
      case 'neq': return left !== right
      default: return left === right
    }
  }

  const left = String(cell ?? '').toLowerCase()
  const right = raw.toLowerCase()
  switch (rule.operator) {
    case 'contains': return left.includes(right)
    case 'notContains': return !left.includes(right)
    case 'neq': return left !== right
    case 'gt': return left > right
    case 'gte': return left >= right
    case 'lt': return left < right
    case 'lte': return left <= right
    default: return left === right
  }
}

/** All rules must pass — stacked rules narrow, they don't widen. */
export function applyFilters(
  rows: ReportRow[],
  columns: ReportColumn[],
  rules: FilterRule[]
): ReportRow[] {
  const active = rules.filter((rule) => rule.column && rule.value.trim())
  if (active.length === 0) return rows

  const typeOf = new Map(columns.map((column) => [column.key, column.type]))
  return rows.filter((row) =>
    active.every((rule) => {
      const type = typeOf.get(rule.column)
      if (!type) return true
      return testRule(row[rule.column], type, rule)
    })
  )
}

export function applySort(
  rows: ReportRow[],
  columns: ReportColumn[],
  sort: SortRule | null
): ReportRow[] {
  if (!sort) return rows
  const type = columns.find((column) => column.key === sort.column)?.type
  if (!type) return rows

  const factor = sort.direction === 'asc' ? 1 : -1
  // Copy first: the caller's array is memoised upstream and must not be
  // reordered in place.
  return [...rows].sort((a, b) => {
    const left = a[sort.column]
    const right = b[sort.column]

    if (isNumeric(type)) {
      return (Number(left ?? 0) - Number(right ?? 0)) * factor
    }
    // Blank cells sort last regardless of direction — they are absence of a
    // value, not the smallest value.
    const ls = String(left ?? '')
    const rs = String(right ?? '')
    if (!ls && !rs) return 0
    if (!ls) return 1
    if (!rs) return -1
    return ls.localeCompare(rs) * factor
  })
}

/** Totals must follow the filters, or the footer contradicts the rows above it. */
export function computeTotals(columns: ReportColumn[], rows: ReportRow[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const column of columns) {
    if (!isNumeric(column.type)) continue
    totals[column.key] = rows.reduce((sum, row) => {
      const n = Number(row[column.key])
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
  }
  return totals
}

export function numericColumns(columns: ReportColumn[]): ReportColumn[] {
  return columns.filter((column) => isNumeric(column.type))
}

export function dimensionColumns(columns: ReportColumn[]): ReportColumn[] {
  return columns.filter((column) => !isNumeric(column.type))
}
