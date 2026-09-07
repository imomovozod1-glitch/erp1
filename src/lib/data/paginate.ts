import 'server-only'
import { getCacheClient } from '@/lib/supabase/cache-client'

/**
 * Server-side pagination for the list pages.
 *
 * Every table used to receive the tenant's ENTIRE table — `getCachedProducts`
 * returned every product, `getCachedTransactions` every transaction — and then
 * sliced ten rows out of it in the browser. Search and status filters ran in
 * JavaScript over the full array too. That is fine at 50 rows and ruinous at
 * 50,000: the cost of opening a list page grew linearly with how long the
 * tenant had been using the product, in both query time and transferred JSON.
 *
 * These helpers push page, search and filter into Postgres and return only the
 * rows actually being displayed, plus the exact total for the pager.
 *
 * Deliberately NOT wrapped in `unstable_cache`: the cache key would have to
 * include page + search term + filters, so every keystroke of a search would
 * mint a new entry that is never read again. A `.range()`-limited query against
 * an indexed, tenant-scoped table is already cheap.
 */

export const DEFAULT_PAGE_SIZE = 10

export interface PageResult<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PageParams {
  page?: number
  pageSize?: number
  search?: string
}

/**
 * Clamps user-supplied paging input; `page` is 1-based.
 *
 * `Math.max(Math.trunc(NaN), 1)` is NaN, not 1 — so a non-numeric `?page=`
 * would otherwise reach `.range()` as NaN and return nothing. Guard the
 * conversion rather than relying on every caller to pre-validate.
 */
export function normalisePageParams(params: PageParams) {
  const toInt = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) ? Math.trunc(value as number) : fallback
  const pageSize = Math.min(Math.max(toInt(params.pageSize, DEFAULT_PAGE_SIZE), 1), 100)
  const page = Math.max(toInt(params.page, 1), 1)
  return { page, pageSize, search: (params.search ?? '').trim() }
}

/**
 * Escapes a search term for PostgREST's `or=(col.ilike.*term*)` syntax, where
 * a comma or parenthesis would otherwise be read as filter structure rather
 * than as text — a customer named "Foo, Ltd (UK)" would produce a malformed
 * filter and an error instead of a result.
 */
export function escapeSearchTerm(term: string): string {
  return term.replace(/[(),*\\]/g, (c) => `\\${c}`)
}

/** Builds the `or(...)` filter string for a case-insensitive search over `columns`. */
export function ilikeAny(columns: string[], term: string): string {
  const safe = escapeSearchTerm(term)
  return columns.map((c) => `${c}.ilike.*${safe}*`).join(',')
}

interface QueryPageOptions {
  table: string
  tenantId: string
  select: string
  page: number
  pageSize: number
  /** Columns to search with ILIKE when a term is given. */
  searchColumns?: string[]
  search?: string
  orderBy?: { column: string; ascending?: boolean }
  /** Extra equality filters, e.g. `{ is_active: true }`. Undefined values are skipped. */
  filters?: Record<string, string | number | boolean | undefined>
  /** Values the column must be one of. */
  inFilters?: Record<string, (string | number)[] | undefined>
}

/**
 * Runs one paginated, tenant-scoped query and returns the rows plus an exact
 * total. `count: 'exact'` makes Postgres compute the total for the pager;
 * `.range()` fetches only the current window.
 */
export async function queryPage<T = Record<string, unknown>>(
  options: QueryPageOptions
): Promise<PageResult<T>> {
  const supabase = getCacheClient() as any
  const { page, pageSize } = options
  const from = (page - 1) * pageSize

  let query = supabase
    .from(options.table)
    .select(options.select, { count: 'exact' })
    .eq('tenant_id', options.tenantId)

  for (const [column, value] of Object.entries(options.filters ?? {})) {
    if (value !== undefined) query = query.eq(column, value)
  }
  for (const [column, values] of Object.entries(options.inFilters ?? {})) {
    if (values && values.length > 0) query = query.in(column, values)
  }
  if (options.search && options.searchColumns?.length) {
    query = query.or(ilikeAny(options.searchColumns, options.search))
  }
  if (options.orderBy) {
    query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? false })
  }

  const { data, count, error } = await query.range(from, from + pageSize - 1)
  if (error) {
    console.warn(`[paginate] ${options.table} query failed:`, error.message)
    return { rows: [], total: 0, page, pageSize, totalPages: 0 }
  }

  const total = count ?? 0
  return {
    rows: (data ?? []) as T[],
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  }
}

/** Reads paging/search off a Next.js `searchParams` object. */
export function readPageParams(
  searchParams: Record<string, string | string[] | undefined>
): { page: number; pageSize: number; search: string } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const rawPage = Number(one(searchParams.page))
  return normalisePageParams({
    page: Number.isFinite(rawPage) ? rawPage : 1,
    search: one(searchParams.q) ?? '',
  })
}

/**
 * Resolves a period key from the URL into an inclusive [from, to) ISO range.
 *
 * The transactions page used to hold the period in component state and filter
 * the full transaction list in the browser. With the list paginated in
 * Postgres the range has to be resolved server-side, so the filter moves into
 * the URL alongside page and search.
 */
export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'

export function resolvePeriodRange(
  period: PeriodKey,
  customStart?: string,
  customEnd?: string
): { from?: string; to?: string } {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString()

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const y = new Date(now.getTime() - 86_400_000)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case 'week':
      return { from: new Date(now.getTime() - 7 * 86_400_000).toISOString() }
    case 'month':
      return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString() }
    case 'custom':
      return {
        from: customStart ? new Date(customStart).toISOString() : undefined,
        to: customEnd ? new Date(customEnd).toISOString() : undefined,
      }
    default:
      return {}
  }
}
