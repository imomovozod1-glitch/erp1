import { getCacheClient } from '@/lib/supabase/cache-client'
import { REPORT_ROW_LIMIT, type ColumnType, type ReportColumn, type ReportGrouping, type ReportRequest, type ReportResult } from '@/lib/reports/definitions'

export interface EngineContext {
  tenantId: string
  /** Set when the caller may only see their own records; undefined = all. */
  ownerId?: string
}

export type Row = Record<string, any>
export type Runner = (ctx: EngineContext, req: ReportRequest) => Promise<ReportResult>

type Order = { asc: string } | { desc: string } | { descAbs: string }

/** One way of presenting a source: its columns and, when grouped, what it groups by. */
export interface ReportView {
  columns: Record<string, ColumnType>
  /** Label fields of a group; the first one is the group key. Absent = one row per record. */
  by?: string[]
  /** Counts distinct `__countOn` values per group into this field. */
  count?: string
  sums?: string[]
  order?: Order
}

export const toNumber = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function periodKey(date: string | null | undefined, grouping: ReportGrouping) {
  const iso = String(date ?? '').split('T')[0]
  if (!iso) return '—'
  return grouping === 'month' ? iso.slice(0, 7) : iso
}

export function matchesSearch(search: string | undefined, ...values: (string | null | undefined)[]) {
  const needle = search?.trim().toLowerCase()
  return !needle || values.some((value) => String(value ?? '').toLowerCase().includes(needle))
}

/** The caller's own records, plus rows nobody owns. */
export const ownedBy = (ownerId: string | undefined, owner: string | null | undefined) => !ownerId || !owner || owner === ownerId

// The generated database types predate tenancy (no `tenant_id`), so the client is untyped here.
export const reportClient = () => getCacheClient() as any

/** Reads at most one row past the cap, so a truncated result can say so. */
export async function fetchRows(query: any): Promise<Row[]> {
  const { data, error } = await query.limit(REPORT_ROW_LIMIT + 1)
  if (error) throw new Error(error.message)
  return data ?? []
}

function groupRows(rows: Row[], view: ReportView, sums: string[]) {
  const [keyField, ...rest] = view.by as string[]
  const groups = new Map<string, { row: Row; seen: Set<string> }>()
  for (const row of rows) {
    const key = String(row[keyField])
    let group = groups.get(key)
    if (!group) {
      const labels = Object.fromEntries([keyField, ...rest].map((field) => [field, row[field]]))
      group = { row: { ...labels, ...Object.fromEntries(sums.map((f) => [f, 0])), ...(view.count ? { [view.count]: 0 } : {}) }, seen: new Set() }
      groups.set(key, group)
    }
    for (const field of sums) group.row[field] += toNumber(row[field])
    if (view.count && row.__countOn && !group.seen.has(row.__countOn)) {
      group.seen.add(row.__countOn)
      group.row[view.count] += 1
    }
  }
  return [...groups.values()].map((group) => group.row)
}

const compare = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)))

function sortRows(rows: Row[], order?: Order) {
  if (!order) return rows
  if ('asc' in order) return rows.sort((a, b) => compare(a[order.asc], b[order.asc]))
  if ('desc' in order) return rows.sort((a, b) => compare(b[order.desc], a[order.desc]))
  return rows.sort((a, b) => Math.abs(toNumber(b[order.descAbs])) - Math.abs(toNumber(a[order.descAbs])))
}

function finish(columns: ReportColumn[], rows: Row[], rawCount: number): ReportResult {
  const trimmed = rows.slice(0, REPORT_ROW_LIMIT).map((row) => Object.fromEntries(columns.map((c) => [c.key, row[c.key] ?? (c.type === 'text' ? '' : 0)])))
  const numeric = columns.filter((c) => c.type === 'money' || c.type === 'number')
  const totals = Object.fromEntries(numeric.map((c) => [c.key, trimmed.reduce((sum, row) => sum + toNumber(row[c.key]), 0)]))
  return { columns, rows: trimmed, totals, truncated: rawCount > REPORT_ROW_LIMIT }
}

/** Picks the view for the requested grouping (falling back to `none`), groups, sorts and caps the rows. */
export function present(rows: Row[], views: Partial<Record<ReportGrouping, ReportView>>, grouping: ReportGrouping, sums: string[]) {
  const view = views[grouping] ?? (views.none as ReportView)
  const shaped = view.by ? groupRows(rows, view, view.sums ?? sums) : rows.slice()
  const columns = Object.entries(view.columns).map(([key, type]) => ({ key, type }))
  return finish(columns, sortRows(shaped, view.order), rows.length)
}
