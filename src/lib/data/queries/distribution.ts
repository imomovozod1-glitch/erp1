/**
 * Routes (marshrut) and deliveries (yetkazib berish).
 *
 * Part of the query layer described in `./index.ts` — every cached function
 * here is tagged for invalidation and MUST filter by `tenant_id` explicitly:
 * the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { queryPage, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

const ROUTE_SELECT =
  '*, agent:profiles!distribution_routes_agent_id_fkey(id, full_name), assignee:profiles!distribution_routes_assigned_to_fkey(full_name)'

const DELIVERY_SELECT =
  '*, customer:customers(id, name, phone, address), order:sales_orders(id, order_number, status, total_amount), ' +
  'route:distribution_routes(id, name), agent:profiles!deliveries_agent_id_fkey(id, full_name), ' +
  'assignee:profiles!deliveries_assigned_to_fkey(full_name)'

/**
 * Every route with its stop count — the routes list.
 *
 * Loaded whole, like the role templates and compositions lists: a tenant runs
 * a handful of rounds, not a ledger that grows forever.
 */
export const getCachedRoutes = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('distribution_routes')
      .select(`${ROUTE_SELECT}, stops:distribution_route_stops(id)`)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return (data ?? []) as any[]
  },
  ['routes-list'],
  { tags: [CACHE_TAGS.routes, CACHE_TAGS.customers], revalidate: 60 }
)

export const getCachedRouteDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [{ data: route }, { data: stops }] = await Promise.all([
      supabase.from('distribution_routes').select(ROUTE_SELECT).eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
      supabase
        .from('distribution_route_stops')
        .select('*, customer:customers(id, name, phone, address)')
        .eq('route_id', id)
        .eq('tenant_id', tenantId)
        .order('position'),
    ])
    return { route, stops: stops ?? [] }
  },
  ['route-details-by-id'],
  { tags: [CACHE_TAGS.routes, CACHE_TAGS.customers], revalidate: 30 }
)

/** Active routes for the delivery form's picker. */
export const getCachedRoutesForSelect = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('distribution_routes')
      .select('id, name, agent_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')
    return (data ?? []) as { id: string; name: string; agent_id: string | null }[]
  },
  ['routes-select'],
  { tags: [CACHE_TAGS.routes], revalidate: 120 }
)

export function getDeliveriesPage(
  tenantId: string,
  opts: {
    page: number
    pageSize: number
    search?: string
    status?: 'all' | 'pending' | 'in_transit' | 'delivered' | 'cancelled'
    ownerId?: string
  }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'deliveries',
    tenantId,
    select: DELIVERY_SELECT,
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['delivery_number', 'address'],
    filters: { status: opts.status === 'all' || !opts.status ? undefined : opts.status },
    orderBy: { column: 'created_at', ascending: false },
    ownerId: opts.ownerId,
  })
}

export const getCachedDeliveryDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('deliveries')
      .select(DELIVERY_SELECT)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    return data as any
  },
  ['delivery-details-by-id'],
  { tags: [CACHE_TAGS.deliveries, CACHE_TAGS.orders, CACHE_TAGS.customers], revalidate: 30 }
)

/**
 * The rounds a customer is on and the deliveries headed their way — the
 * distribution strip on the customer's own page.
 */
export const getCachedCustomerDistribution = unstable_cache(
  async (customerId: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [{ data: stops }, { data: deliveries }] = await Promise.all([
      supabase
        .from('distribution_route_stops')
        .select(
          'id, position, route:distribution_routes(id, name, weekday, is_active, ' +
            'agent:profiles!distribution_routes_agent_id_fkey(full_name))'
        )
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .order('position'),
      supabase
        .from('deliveries')
        .select('id, delivery_number, status, planned_date, agent:profiles!deliveries_agent_id_fkey(full_name)')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    return { stops: stops ?? [], deliveries: deliveries ?? [] }
  },
  ['customer-distribution-by-id'],
  { tags: [CACHE_TAGS.routes, CACHE_TAGS.deliveries, CACHE_TAGS.customers], revalidate: 30 }
)

/**
 * Sales orders that could still use a delivery, for the "new delivery" picker:
 * not cancelled, not already delivered, and not already on a delivery of their
 * own. Uncached — a sale rung up seconds ago is exactly the one being sent out.
 */
export async function getDeliverableOrders(tenantId: string) {
  const supabase = getCacheClient() as any
  const [{ data: orders }, { data: taken }] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id, order_number, status, total_amount, order_date, customer_id, customers(id, name, phone, address)')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("cancelled","delivered")')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('deliveries')
      .select('order_id')
      .eq('tenant_id', tenantId)
      .not('status', 'eq', 'cancelled')
      .not('order_id', 'is', null),
  ])
  const used = new Set((taken ?? []).map((d: any) => d.order_id))
  return ((orders ?? []) as any[]).filter((o) => !used.has(o.id))
}

/**
 * The agent breakdown shown above the deliveries list: how many deliveries
 * each agent is carrying, and how many they have handed over.
 *
 * Counted here rather than in the browser because the list page only holds one
 * page of rows — a per-agent total computed from ten of five hundred rows
 * would simply be wrong.
 */
export const getCachedDeliveryStats = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('deliveries')
      .select('status, agent_id, agent:profiles!deliveries_agent_id_fkey(full_name)')
      .eq('tenant_id', tenantId)

    const rows = (data ?? []) as any[]
    const byStatus: Record<string, number> = { pending: 0, in_transit: 0, delivered: 0, cancelled: 0 }
    const byAgent = new Map<string, { id: string | null; name: string | null; open: number; delivered: number }>()

    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
      if (row.status === 'cancelled') continue
      const key = row.agent_id ?? 'none'
      const entry = byAgent.get(key) ?? {
        id: row.agent_id ?? null,
        name: row.agent?.full_name ?? null,
        open: 0,
        delivered: 0,
      }
      if (row.status === 'delivered') entry.delivered += 1
      else entry.open += 1
      byAgent.set(key, entry)
    }

    return {
      total: rows.length,
      byStatus,
      agents: [...byAgent.values()].sort((a, b) => b.open + b.delivered - (a.open + a.delivered)),
    }
  },
  ['delivery-stats'],
  { tags: [CACHE_TAGS.deliveries, 'profiles'], revalidate: 60 }
)

/**
 * max(numeric suffix of delivery_number) + 1, for the "new delivery" form.
 *
 * Deliberately NOT cached, for the same reason as the production run number:
 * `deliveries_tenant_number_key` makes it unique, so a cached answer would
 * hand two people the same number.
 */
export async function getNextDeliveryNumber(tenantId: string) {
  const supabase = getCacheClient() as any
  const { data } = await supabase.from('deliveries').select('delivery_number').eq('tenant_id', tenantId)
  let max = 0
  for (const row of data ?? []) {
    const parsed = Number.parseInt(String(row.delivery_number).replace(/\D+/g, ''), 10)
    if (Number.isFinite(parsed) && parsed > max) max = parsed
  }
  return `YB-${String(max + 1).padStart(5, '0')}`
}
