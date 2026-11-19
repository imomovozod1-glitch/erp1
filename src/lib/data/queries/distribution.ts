/**
 * Routes (marshrut); deliveries live in `./deliveries.ts`.
 *
 * Part of the query layer described in `./index.ts` — every cached function
 * here is tagged for invalidation and MUST filter by `tenant_id` explicitly:
 * the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { ilikeAny, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

const ROUTE_SELECT =
  '*, agent:profiles!distribution_routes_agent_id_fkey(id, full_name), assignee:profiles!distribution_routes_assigned_to_fkey(full_name)'

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

/**
 * One page of the routes list, with each route's stops for the count column.
 *
 * Hand-rolled rather than `queryPage` because the search also matches the
 * agent's name, which lives on `profiles`: the matching agents are resolved
 * first and folded into the same `or(...)` as the route-name match.
 */
export async function getRoutesPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string }
): Promise<PageResult<any>> {
  const supabase = getCacheClient() as any
  const from = (opts.page - 1) * opts.pageSize
  const term = opts.search?.trim() ?? ''

  let query = supabase
    .from('distribution_routes')
    .select(`${ROUTE_SELECT}, stops:distribution_route_stops(id)`, { count: 'exact' })
    .eq('tenant_id', tenantId)

  if (term) {
    const { data: agents } = await supabase
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('full_name', `%${term.replace(/[%_\\]/g, (c: string) => `\\${c}`)}%`)
      .limit(500)
    const agentIds = ((agents ?? []) as { id: string }[]).map((a) => a.id)
    const nameMatch = ilikeAny(['name'], term)
    query = query.or(agentIds.length ? `${nameMatch},agent_id.in.(${agentIds.join(',')})` : nameMatch)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + opts.pageSize - 1)
  if (error) {
    console.warn('[routes] page query failed:', error.message)
    return { rows: [], total: 0, page: opts.page, pageSize: opts.pageSize, totalPages: 0 }
  }
  const total = count ?? 0
  return {
    rows: (data ?? []) as any[],
    total,
    page: opts.page,
    pageSize: opts.pageSize,
    totalPages: Math.max(Math.ceil(total / opts.pageSize), 1),
  }
}

export const getCachedRouteDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [{ data: route }, { data: stops }] = await Promise.all([
      supabase.from('distribution_routes').select(ROUTE_SELECT).eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
      supabase
        .from('distribution_route_stops')
        .select('*, customer:customers(id, name, phone, address, latitude, longitude)')
        .eq('route_id', id)
        .eq('tenant_id', tenantId)
        .order('position'),
    ])
    return { route, stops: stops ?? [] }
  },
  ['route-details-by-id'],
  { tags: [CACHE_TAGS.routes, CACHE_TAGS.customers], revalidate: 30 }
)

/**
 * Customers for the route form's stop picker.
 *
 * Deliberately not getCachedCustomersForSelect: that one is `id, name` and is
 * used by half the forms in the app, while a marshrut stop is only useful if
 * it can be put on a map — so this carries the pin as well, and the picker can
 * say which customers have no address saved yet.
 */
export const getCachedCustomersForRouting = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, address, latitude, longitude')
      .eq('tenant_id', tenantId)
      .order('name')
    return (data ?? []) as {
      id: string
      name: string
      phone: string | null
      address: string | null
      latitude: number | null
      longitude: number | null
    }[]
  },
  ['customers-routing'],
  { tags: [CACHE_TAGS.customers], revalidate: 120 }
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
