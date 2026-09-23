/**
 * Customers, their categories, balances and map points.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { queryPage, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

export const getCachedCustomers = unstable_cache(
  async (tenantId: string) => {
    // `customer_categories` postdates the generated Supabase types (only exists once
    // the customer-categories migration has been run) — cast to `any` until
    // `database.types.ts` is regenerated against the live schema.
    const supabase = getCacheClient() as any
    const [{ data: customers }, { data: unpaidInvoices }] = await Promise.all([
      supabase.from('customers').select('*, customer_categories(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('invoices').select('customer_id, total_amount, paid_amount').eq('tenant_id', tenantId).not('status', 'in', '("paid","cancelled")'),
    ])

    const debtByCustomer = new Map<string, number>()
    for (const inv of unpaidInvoices ?? []) {
      if (!inv.customer_id) continue
      const outstanding = (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0)
      debtByCustomer.set(inv.customer_id, (debtByCustomer.get(inv.customer_id) || 0) + outstanding)
    }

    return (customers ?? []).map((c: any) => ({ ...c, total_debt: debtByCustomer.get(c.id) || 0 }))
  },
  ['customers-list'],
  { tags: [CACHE_TAGS.customers, CACHE_TAGS.invoices, CACHE_TAGS.customerCategories], revalidate: 60 }
)

export const getCachedCustomersForSelect = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['customers-select'],
  { tags: [CACHE_TAGS.customers], revalidate: 120 }
)

export const getCachedCustomerCategories = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('customer_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['customer-categories-list'],
  { tags: [CACHE_TAGS.customerCategories], revalidate: 60 }
)

export const getCachedCustomerById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('customers')
      .select('*, customer_categories(name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    return data
  },
  ['customer-by-id'],
  { tags: [CACHE_TAGS.customers, CACHE_TAGS.customerCategories], revalidate: 60 }
)

export const getCachedCustomerDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [
      { data: customer },
      { data: salesOrders },
      { data: invoices },
      { data: transactions },
    ] = await Promise.all([
      supabase.from('customers').select('*, customer_categories(name)').eq('id', id).eq('tenant_id', tenantId).single(),
      supabase.from('sales_orders').select('*').eq('customer_id', id).eq('tenant_id', tenantId).order('order_date', { ascending: false }),
      supabase.from('invoices').select('*').eq('customer_id', id).eq('tenant_id', tenantId).order('issued_at', { ascending: false }),
      supabase.from('transactions').select('*').eq('customer_id', id).eq('tenant_id', tenantId).order('transaction_date', { ascending: false }),
    ])

    return {
      customer,
      salesOrders: salesOrders ?? [],
      invoices: invoices ?? [],
      transactions: transactions ?? [],
    }
  },
  ['customer-details-by-id'],
  { tags: [CACHE_TAGS.customers, CACHE_TAGS.orders, CACHE_TAGS.invoices, CACHE_TAGS.transactions, CACHE_TAGS.customerCategories], revalidate: 30 }
)


// These replace the "fetch the whole table, slice ten rows in the browser"
// pattern the list pages used. See src/lib/data/paginate.ts for why they are
// not wrapped in unstable_cache.

/**
 * Customers need the outstanding-debt figure the list column shows. That is
 * derived from invoices, so it is computed only for the customers on the
 * CURRENT page — the previous version summed debt across every invoice in the
 * tenant on every page load.
 */
export type CustomerBalanceFilter = 'debtor' | 'creditor' | 'zero'

export async function getCustomersPage(
  tenantId: string,
  opts: {
    page: number
    pageSize: number
    search?: string
    ownerId?: string
    /** Narrow to who owes us, who holds credit, or whose account is settled. */
    balance?: CustomerBalanceFilter
  }
): Promise<PageResult<any>> {
  // Debt is not a column — it is what is still open on the customer's invoices,
  // computed below — so a balance filter cannot be an `.eq()` on the paged
  // query. The matching ids are worked out first, across the whole tenant, and
  // the page is then taken from that set. The `own` scope still applies on top:
  // queryPage narrows by assignee independently of this list.
  let balanceIds: string[] | null = null
  if (opts.balance) {
    balanceIds = await customerIdsByBalance(tenantId, opts.balance)
    // No matches at all. Returned here rather than passed down, because an
    // empty `in` list is ignored by queryPage — which would show every
    // customer instead of none.
    if (balanceIds.length === 0) {
      return { rows: [], total: 0, page: opts.page, pageSize: opts.pageSize, totalPages: 0 }
    }
  }

  const result = await queryPage<any>({
    table: 'customers',
    tenantId,
    select: '*, customer_categories(name), creator:profiles!customers_created_by_fkey(full_name), assignee:profiles!customers_assigned_to_fkey(full_name)',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['name', 'email', 'phone'],
    orderBy: { column: 'created_at', ascending: false },
    ownerId: opts.ownerId,
    ...(balanceIds ? { inFilters: { id: balanceIds } } : {}),
  })

  if (result.rows.length === 0) return result

  const supabase = getCacheClient() as any
  const { data: unpaid } = await supabase
    .from('invoices')
    .select('customer_id, total_amount, paid_amount')
    .eq('tenant_id', tenantId)
    .in('customer_id', result.rows.map((c) => c.id))
    .not('status', 'in', '("paid","cancelled")')

  const debtByCustomer = new Map<string, number>()
  for (const inv of unpaid ?? []) {
    if (!inv.customer_id) continue
    const outstanding = (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0)
    debtByCustomer.set(inv.customer_id, (debtByCustomer.get(inv.customer_id) || 0) + outstanding)
  }

  return {
    ...result,
    rows: result.rows.map((c) => ({ ...c, total_debt: debtByCustomer.get(c.id) || 0 })),
  }
}

/**
 * Every customer whose balance matches, for the whole tenant.
 *
 * Balance is credit held minus debt outstanding, the same arithmetic the list
 * and the totals card use — kept in one place so the filter can never disagree
 * with the number printed on the row it filtered.
 */
async function customerIdsByBalance(
  tenantId: string,
  balance: CustomerBalanceFilter
): Promise<string[]> {
  const supabase = getCacheClient() as any
  const [{ data: customers }, { data: unpaid }] = await Promise.all([
    supabase.from('customers').select('id, credit_balance').eq('tenant_id', tenantId),
    supabase
      .from('invoices')
      .select('customer_id, total_amount, paid_amount')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("paid","cancelled")'),
  ])

  const debtByCustomer = new Map<string, number>()
  for (const inv of unpaid ?? []) {
    if (!inv.customer_id) continue
    const outstanding = (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0)
    debtByCustomer.set(inv.customer_id, (debtByCustomer.get(inv.customer_id) || 0) + outstanding)
  }

  return (customers ?? [])
    .filter((c: any) => {
      const value = (Number(c.credit_balance) || 0) - (debtByCustomer.get(c.id) || 0)
      if (balance === 'debtor') return value < 0
      if (balance === 'creditor') return value > 0
      return value === 0
    })
    .map((c: any) => c.id as string)
}

/**
 * Map markers only: the customers map needs every customer that has
 * coordinates, but only the fields it plots — not the full rows the list
 * shows. Keeping this separate is what lets the list be paginated while the
 * map still plots the whole (permitted) set.
 *
 * `ownerId` applies the same "mine or nobody's" rule `queryPage` uses for the
 * list (see src/lib/data/paginate.ts), so a user on the `own` data scope can
 * never see another salesperson's customers by switching to the map tab.
 * `assigned_to` is returned so the map can additionally offer a strict
 * "only mine" filter on top of whatever the scope allowed.
 */
export const getCustomersMapPoints = unstable_cache(
  async (tenantId: string, ownerId?: string) => {
    const supabase = getCacheClient() as any
    let query = supabase
      .from('customers')
      .select('id, name, phone, address, latitude, longitude, assigned_to')
      .eq('tenant_id', tenantId)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
    if (ownerId) {
      query = query.or(`assigned_to.eq.${ownerId},assigned_to.is.null`)
    }
    const { data } = await query
    return data ?? []
  },
  ['customers-map-points'],
  { tags: [CACHE_TAGS.customers], revalidate: 120 }
)

/**
 * Tenant-wide debt/credit totals for the customers page KPI. Computed by the
 * database over every customer — the page used to sum the full customer array
 * it had already downloaded, which stops being possible once the list is
 * paginated (and stops being correct if you only sum the visible page).
 */
export const getCustomerBalanceTotals = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const [{ data: credits }, { data: unpaid }] = await Promise.all([
      supabase.from('customers').select('credit_balance').eq('tenant_id', tenantId),
      supabase
        .from('invoices')
        .select('total_amount, paid_amount')
        .eq('tenant_id', tenantId)
        .not('status', 'in', '("paid","cancelled")'),
    ])
    const totalCredit = (credits ?? []).reduce(
      (sum: number, c: any) => sum + (Number(c.credit_balance) || 0), 0)
    const totalDebt = (unpaid ?? []).reduce(
      (sum: number, i: any) => sum + ((Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0)), 0)
    return { totalCredit, totalDebt }
  },
  ['customer-balance-totals'],
  { tags: [CACHE_TAGS.customers, CACHE_TAGS.invoices], revalidate: 60 }
)
