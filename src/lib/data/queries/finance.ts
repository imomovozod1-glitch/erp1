/**
 * Cashboxes, transactions and their categories.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { ilikeAny, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

export const getCachedTransactions = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['transactions-list'],
  { tags: [CACHE_TAGS.transactions], revalidate: 30 }
)

export const getCachedTransactionCategories = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('transaction_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['transaction-categories-list'],
  { tags: [CACHE_TAGS.transactionCategories], revalidate: 120 }
)

export const getCachedCashboxPageData = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any

    const [cashboxRes, customers, employees, suppliers, categories] = await Promise.all([
      supabase
        .from('cashboxes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      supabase
        .from('customers')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('employees')
        .select('id, employee_code, profiles(full_name)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
      supabase
        .from('suppliers')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabase
        .from('transaction_categories')
        .select('id, name, type, person_type')
        .eq('tenant_id', tenantId)
        .order('name'),
    ])

    return {
      // Only the cashboxes read decides `failed` — the pickers are optional
      // extras, and an empty supplier list should never push the whole screen
      // into offline mode.
      failed: Boolean(cashboxRes.error),
      cashboxes: cashboxRes.data ?? [],
      customers: customers.data ?? [],
      employees: (employees.data ?? []).map((emp: any) => ({
        id: emp.id as string,
        name: (emp.profiles?.full_name || emp.employee_code || '') as string,
      })),
      suppliers: suppliers.data ?? [],
      categories: categories.data ?? [],
    }
  },
  ['cashbox-page-data'],
  {
    tags: [
      CACHE_TAGS.cashbox,
      CACHE_TAGS.transactionCategories,
      CACHE_TAGS.customers,
      CACHE_TAGS.employees,
      CACHE_TAGS.suppliers,
    ],
    revalidate: 30,
  }
)

/**
 * The cashbox transaction history for one period.
 *
 * Split out from the standing data above and keyed on the range so that
 * changing the period re-runs THIS query only, instead of re-reading the five
 * lists that cannot have changed. Filtering here rather than in the browser is
 * what stops the screen from shipping a tenant's entire cashbox history —
 * every row ever written — just to display last week's.
 *
 * Bounded by `transaction_date`, the day the money moved, which is the column
 * the screen's period tabs have always meant (see `resolvePeriodDays`).
 */
export const getCachedCashboxTransactions = unstable_cache(
  async (tenantId: string, from?: string, to?: string) => {
    const supabase = getCacheClient() as any
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('reference_type', 'cashbox')
    if (from) query = query.gte('transaction_date', from)
    if (to) query = query.lte('transaction_date', to)
    const { data } = await query.order('created_at', { ascending: false })
    return data ?? []
  },
  ['cashbox-transactions'],
  { tags: [CACHE_TAGS.cashbox, CACHE_TAGS.transactions], revalidate: 30 }
)

export const getCachedTransactionById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    return data
  },
  ['transaction-by-id'],
  { tags: [CACHE_TAGS.transactions], revalidate: 30 }
)

/**
 * Transactions also need income/expense totals for the table's footer row.
 * Those must cover the WHOLE filtered set, not the current page — summing only
 * the visible rows would put a confidently wrong "Jami" under every page.
 */
export async function getTransactionsPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; from?: string; to?: string; ownerId?: string }
): Promise<PageResult<any> & { totalIncome: number; totalExpense: number }> {
  const [result, totals] = await Promise.all([
    getTransactionsPageRows(tenantId, opts),
    getTransactionTotals(tenantId, opts),
  ])
  return { ...result, ...totals }
}

async function getTransactionTotals(
  tenantId: string,
  opts: { search?: string; from?: string; to?: string }
) {
  const supabase = getCacheClient() as any
  let query = supabase.from('transactions').select('type, amount').eq('tenant_id', tenantId)
  if (opts.search?.trim()) query = query.or(ilikeAny(['category', 'description'], opts.search.trim()))
  if (opts.from) query = query.gte('created_at', opts.from)
  if (opts.to) query = query.lte('created_at', opts.to)
  const { data } = await query
  let totalIncome = 0
  let totalExpense = 0
  for (const row of (data ?? []) as { type: string; amount: number }[]) {
    if (row.type === 'income') totalIncome += Number(row.amount) || 0
    else totalExpense += Number(row.amount) || 0
  }
  return { totalIncome, totalExpense }
}

async function getTransactionsPageRows(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; from?: string; to?: string; ownerId?: string }
): Promise<PageResult<any>> {
  const supabase = getCacheClient() as any
  const from = (opts.page - 1) * opts.pageSize
  let query = supabase
    .from('transactions')
    .select('*, creator:profiles!transactions_created_by_fkey(full_name), assignee:profiles!transactions_assigned_to_fkey(full_name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
  if (opts.search?.trim()) query = query.or(ilikeAny(['category', 'description'], opts.search.trim()))
  if (opts.from) query = query.gte('created_at', opts.from)
  if (opts.to) query = query.lte('created_at', opts.to)
  if (opts.ownerId) query = query.or(`assigned_to.eq.${opts.ownerId},assigned_to.is.null`)
  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + opts.pageSize - 1)
  const total = count ?? 0
  return {
    rows: data ?? [],
    total,
    page: opts.page,
    pageSize: opts.pageSize,
    totalPages: Math.max(Math.ceil(total / opts.pageSize), 1),
  }
}
