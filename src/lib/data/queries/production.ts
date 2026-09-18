/**
 * Compositions (tarkib) and production runs (ishlab chiqarish).
 *
 * Part of the query layer described in `./index.ts` — every cached function
 * here is tagged for invalidation and MUST filter by `tenant_id` explicitly:
 * the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { queryPage, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

const BOM_SELECT =
  '*, product:products!product_boms_product_id_fkey(id, name, sku, unit), assignee:profiles!product_boms_assigned_to_fkey(full_name)'

const ORDER_SELECT =
  '*, product:products!production_orders_product_id_fkey(id, name, sku, unit), bom:product_boms(id, name), assignee:profiles!production_orders_assigned_to_fkey(full_name)'

/**
 * Every composition, with its component count — the compositions list, loaded
 * the way `getCachedRoleTemplates` loads role templates.
 *
 * Compositions are reference data a tenant has a handful of, not a ledger that
 * grows forever, so the whole list is cached and searched in the browser
 * instead of paged through Postgres.
 */
export const getCachedBoms = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('product_boms')
      .select(`${BOM_SELECT}, items:product_bom_items(id)`)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return (data ?? []) as any[]
  },
  ['boms-list'],
  { tags: [CACHE_TAGS.boms, CACHE_TAGS.products], revalidate: 60 }
)

export function getProductionOrdersPage(
  tenantId: string,
  opts: {
    page: number
    pageSize: number
    search?: string
    status?: 'all' | 'draft' | 'completed' | 'cancelled'
    ownerId?: string
  }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'production_orders',
    tenantId,
    select: ORDER_SELECT,
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['order_number'],
    filters: { status: opts.status === 'all' || !opts.status ? undefined : opts.status },
    orderBy: { column: 'created_at', ascending: false },
    ownerId: opts.ownerId,
  })
}

/**
 * Recipes for the production-order form's picker.
 *
 * Uncached for the same reason as `getCachedProductsForSelect`: this only
 * powers the rarely-visited "new run" page, where a recipe created seconds ago
 * missing from the list is actively harmful and one extra round trip is free.
 */
export async function getBomsForSelect(tenantId: string) {
  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('product_boms')
    .select('id, name, product_id, output_quantity, extra_cost, product:products!product_boms_product_id_fkey(id, name, unit), items:product_bom_items(component_id, quantity, component:products!product_bom_items_component_id_fkey(id, name, unit, cost_price, stock, is_service))')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')
  return (data ?? []) as any[]
}

/**
 * The compositions that produce one product, for the "Tarkib" card on its
 * product page. A product may have several — a summer and a winter recipe, a
 * cheap and a premium one — so this is a list, not a single row.
 */
export const getCachedProductBoms = unstable_cache(
  async (productId: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('product_boms')
      .select(
        'id, name, output_quantity, extra_cost, is_active, ' +
          'items:product_bom_items(quantity, component:products!product_bom_items_component_id_fkey(name, unit, cost_price))'
      )
      .eq('product_id', productId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return (data ?? []) as any[]
  },
  ['product-boms-by-product'],
  { tags: [CACHE_TAGS.boms, CACHE_TAGS.products], revalidate: 30 }
)

export const getCachedBomDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [{ data: bom }, { data: items }] = await Promise.all([
      supabase.from('product_boms').select(BOM_SELECT).eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
      supabase
        .from('product_bom_items')
        .select('*, component:products!product_bom_items_component_id_fkey(id, name, sku, unit, cost_price, is_service)')
        .eq('bom_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at'),
    ])
    return { bom, items: items ?? [] }
  },
  ['bom-details-by-id'],
  { tags: [CACHE_TAGS.boms, CACHE_TAGS.products], revalidate: 30 }
)

export const getCachedProductionOrderDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [{ data: order }, { data: items }] = await Promise.all([
      supabase.from('production_orders').select(ORDER_SELECT).eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
      supabase
        .from('production_order_items')
        .select('*, component:products!production_order_items_component_id_fkey(id, name, sku, unit, cost_price, stock, is_service)')
        .eq('order_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at'),
    ])
    return { order, items: items ?? [] }
  },
  ['production-order-details-by-id'],
  { tags: [CACHE_TAGS.productionOrders, CACHE_TAGS.products], revalidate: 30 }
)

/**
 * max(numeric suffix of order_number) + 1, for the "new run" form's default.
 *
 * Deliberately NOT cached: `production_orders_tenant_number_key` makes the
 * number unique per tenant, so a cached answer means two runs started within
 * the same cache window both open on the same number and the second is
 * refused. One indexed scan on the rarely-visited "new run" page is cheap.
 */
export async function getNextProductionNumber(tenantId: string) {
  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('production_orders')
    .select('order_number')
    .eq('tenant_id', tenantId)
  let max = 0
  for (const row of data ?? []) {
    const parsed = Number.parseInt(String(row.order_number).replace(/\D+/g, ''), 10)
    if (Number.isFinite(parsed) && parsed > max) max = parsed
  }
  return `ICH-${String(max + 1).padStart(5, '0')}`
}
