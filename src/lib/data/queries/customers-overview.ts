/**
 * Customers as a whole: the map's points and the balance totals.
 *
 * Same rules as `./index.ts` describes: cached, tagged, and filtered by `tenant_id` by hand.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { ownerExpression, type OwnerFilter } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

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
  async (tenantId: string, ownerId?: OwnerFilter) => {
    const supabase = getCacheClient() as any
    let query = supabase
      .from('customers')
      .select('id, name, phone, address, latitude, longitude, assigned_to')
      .eq('tenant_id', tenantId)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
    if (ownerId) {
      query = query.or(ownerExpression('assigned_to', ownerId))
    }
    const { data } = await query
    return data ?? []
  },
  ['customers-map-points'],
  { tags: [CACHE_TAGS.customers], revalidate: 120 }
)

/**
 * Debt/credit totals for the customers page KPI — tenant-wide, or over the
 * customers an `own`/`department` user may see (`ownerId`, the list's rule).
 * Unscoped, a salesperson's KPI showed the whole company's figures. Computed by the
 * database over every customer — the page used to sum the full customer array
 * it had already downloaded, which stops being possible once the list is
 * paginated (and stops being correct if you only sum the visible page).
 */
export const getCustomerBalanceTotals = unstable_cache(
  async (tenantId: string, ownerId?: OwnerFilter) => {
    const supabase = getCacheClient() as any
    let customersQuery = supabase.from('customers').select('id, credit_balance').eq('tenant_id', tenantId)
    if (ownerId) customersQuery = customersQuery.or(ownerExpression('assigned_to', ownerId))
    const { data: credits } = await customersQuery
    let invoicesQuery = supabase
      .from('invoices')
      .select('total_amount, paid_amount')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("paid","cancelled")')
    if (ownerId) {
      const ids = ((credits ?? []) as { id: string }[]).map((c) => c.id)
      if (ids.length === 0) return { totalCredit: 0, totalDebt: 0 }
      invoicesQuery = invoicesQuery.in('customer_id', ids)
    }
    const { data: unpaid } = await invoicesQuery
    const totalCredit = (credits ?? []).reduce(
      (sum: number, c: any) => sum + (Number(c.credit_balance) || 0), 0)
    const totalDebt = (unpaid ?? []).reduce(
      (sum: number, i: any) => sum + ((Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0)), 0)
    return { totalCredit, totalDebt }
  },
  ['customer-balance-totals'],
  { tags: [CACHE_TAGS.customers, CACHE_TAGS.invoices], revalidate: 60 }
)
