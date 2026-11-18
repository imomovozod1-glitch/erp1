/**
 * Compositions (tarkib) and production runs (ishlab chiqarish).
 *
 * Part of the query layer described in `./index.ts` — every cached function
 * here is tagged for invalidation and MUST filter by `tenant_id` explicitly:
 * the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { ilikeAny, queryPage, type OwnerFilter, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

const BOM_SELECT =
  '*, product:products!product_boms_product_id_fkey(id, name, sku, unit), assignee:profiles!product_boms_assigned_to_fkey(full_name)'

const ORDER_SELECT =
  '*, product:products!production_orders_product_id_fkey(id, name, sku, unit), bom:product_boms(id, name), assignee:profiles!production_orders_assigned_to_fkey(full_name)'

/**
 * Selects with the product_bom_outputs / production_order_outputs embed tried
 * first, falling back to the bare select on a database where
 * migration_production_outputs.sql is not applied yet — every reader then sees
 * one output, the mirrored `product_id`, as before.
 */
async function withOutputs<T>(
  run: (embed: string) => PromiseLike<{ data: T | null; error: { code?: string } | null; count?: number | null }>,
  embed: string
): Promise<{ data: T | null; count?: number | null; error: { code?: string; message?: string } | null }> {
  const first = await run(embed)
  if (!first.error) return first
  console.warn('[production] outputs not available, reading without them:', (first.error as { message?: string }).message)
  return run('')
}

const BOM_OUTPUTS_EMBED =
  ', outputs:product_bom_outputs(product_id, quantity, cost_share, created_at, product:products!product_bom_outputs_product_id_fkey(id, name, unit))'
const ORDER_OUTPUTS_EMBED =
  ', outputs:production_order_outputs(product_id, quantity, created_at, product:products!production_order_outputs_product_id_fkey(id, name, unit))'

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
    const { data } = await withOutputs(
      (embed) =>
        supabase
          .from('product_boms')
          .select(`${BOM_SELECT}, items:product_bom_items(id)${embed}`)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
      BOM_OUTPUTS_EMBED
    )
    return (data ?? []) as any[]
  },
  ['boms-list'],
  { tags: [CACHE_TAGS.boms, CACHE_TAGS.products], revalidate: 60 }
)

/**
 * One page of the compositions list, with each composition's component ids for
 * the count column.
 *
 * Hand-rolled rather than `queryPage` because the search also matches the
 * finished product's name, which lives on `products`: the matching products are
 * resolved first and folded into the same `or(...)` as the composition-name match.
 */
export async function getBomsPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string }
): Promise<PageResult<any>> {
  const supabase = getCacheClient() as any
  const from = (opts.page - 1) * opts.pageSize
  const term = opts.search?.trim() ?? ''

  let productIds: string[] = []
  let outputBomIds: string[] = []
  if (term) {
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${term.replace(/[%_\\]/g, (c: string) => `\\${c}`)}%`)
      .limit(500)
    productIds = ((products ?? []) as { id: string }[]).map((p) => p.id)
    // A composition matches on ANY of its finished products, not just the first.
    if (productIds.length) {
      const { data: outputRows } = await supabase
        .from('product_bom_outputs')
        .select('bom_id')
        .eq('tenant_id', tenantId)
        .in('product_id', productIds)
      outputBomIds = ((outputRows ?? []) as { bom_id: string }[]).map((r) => r.bom_id)
    }
  }

  const { data, count, error } = await withOutputs(
    (embed) => {
      let query = supabase
        .from('product_boms')
        .select(`${BOM_SELECT}, items:product_bom_items(id)${embed}`, { count: 'exact' })
        .eq('tenant_id', tenantId)
      if (term) {
        const filters = [ilikeAny(['name'], term)]
        if (productIds.length) filters.push(`product_id.in.(${productIds.join(',')})`)
        if (outputBomIds.length) filters.push(`id.in.(${[...new Set(outputBomIds)].join(',')})`)
        query = query.or(filters.join(','))
      }
      return query.order('created_at', { ascending: false }).range(from, from + opts.pageSize - 1)
    },
    BOM_OUTPUTS_EMBED
  )
  if (error) {
    console.warn('[boms] page query failed:', error.message)
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

export async function getProductionOrdersPage(
  tenantId: string,
  opts: {
    page: number
    pageSize: number
    search?: string
    status?: 'all' | 'draft' | 'completed' | 'cancelled'
    ownerId?: OwnerFilter
  }
): Promise<PageResult<any>> {
  const page = (select: string) =>
    queryPage({
      table: 'production_orders',
      tenantId,
      select,
      page: opts.page,
      pageSize: opts.pageSize,
      search: opts.search,
      searchColumns: ['order_number'],
      filters: { status: opts.status === 'all' || !opts.status ? undefined : opts.status },
      orderBy: { column: 'created_at', ascending: false },
      ownerId: opts.ownerId,
    })
  // queryPage answers a failed query with totalPages 0 (a real page is >= 1):
  // the outputs embed is retried without on a pre-migration database.
  const result = await page(ORDER_SELECT + ORDER_OUTPUTS_EMBED)
  return result.totalPages === 0 ? page(ORDER_SELECT) : result
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
  const base =
    'id, name, product_id, output_quantity, extra_cost, product:products!product_boms_product_id_fkey(id, name, unit)'
  const { data } = await withOutputs(
    (embed) =>
      supabase
        .from('product_boms')
        .select(
          embed
            ? `${base}, items:product_bom_items(component_id, quantity, consumption), outputs:product_bom_outputs(product_id, quantity, cost_share, created_at)`
            : `${base}, items:product_bom_items(component_id, quantity)`
        )
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name'),
    'outputs'
  )
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
    // Every composition this product comes out of — as its first output or any
    // other. Before migration_production_outputs.sql only the first exists.
    const { data: outputRows, error: outputsError } = await supabase
      .from('product_bom_outputs')
      .select('bom_id, quantity')
      .eq('tenant_id', tenantId)
      .eq('product_id', productId)
    const viaOutputs = new Map<string, number>(
      outputsError ? [] : ((outputRows ?? []) as { bom_id: string; quantity: number }[]).map((r) => [r.bom_id, Number(r.quantity)])
    )
    let query = supabase
      .from('product_boms')
      .select(
        'id, name, product_id, output_quantity, extra_cost, is_active, ' +
          'items:product_bom_items(quantity, component:products!product_bom_items_component_id_fkey(name, unit, cost_price))'
      )
      .eq('tenant_id', tenantId)
    query = viaOutputs.size
      ? query.or(`product_id.eq.${productId},id.in.(${[...viaOutputs.keys()].join(',')})`)
      : query.eq('product_id', productId)
    const { data } = await query.order('created_at', { ascending: false })
    // `output_quantity` here is how much of THIS product one batch yields.
    return ((data ?? []) as any[]).map((bom) => ({
      ...bom,
      output_quantity: viaOutputs.get(bom.id) ?? bom.output_quantity,
    }))
  },
  ['product-boms-by-product'],
  { tags: [CACHE_TAGS.boms, CACHE_TAGS.products], revalidate: 30 }
)

export const getCachedBomDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [{ data: bom }, { data: items }, { data: outputs }] = await Promise.all([
      supabase.from('product_boms').select(BOM_SELECT).eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
      supabase
        .from('product_bom_items')
        .select('*, component:products!product_bom_items_component_id_fkey(id, name, sku, unit, cost_price, is_service)')
        .eq('bom_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at'),
      // Fails quietly on a pre-migration database: the form then rebuilds the
      // single output from product_id / output_quantity.
      supabase
        .from('product_bom_outputs')
        .select('*, product:products!product_bom_outputs_product_id_fkey(id, name, sku, unit)')
        .eq('bom_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at'),
    ])
    return { bom, items: items ?? [], outputs: outputs ?? [] }
  },
  ['bom-details-by-id'],
  { tags: [CACHE_TAGS.boms, CACHE_TAGS.products], revalidate: 30 }
)

export const getCachedProductionOrderDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [{ data: order }, { data: items }, { data: outputs }] = await Promise.all([
      supabase.from('production_orders').select(ORDER_SELECT).eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
      supabase
        .from('production_order_items')
        .select('*, component:products!production_order_items_component_id_fkey(id, name, sku, unit, cost_price, stock, is_service)')
        .eq('order_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at'),
      supabase
        .from('production_order_outputs')
        .select('*, product:products!production_order_outputs_product_id_fkey(id, name, sku, unit, stock)')
        .eq('order_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at'),
    ])
    // A run from before production_order_outputs: its one output is the header.
    const outputRows = (outputs ?? []).length
      ? outputs
      : order
        ? [{ product_id: order.product_id, quantity: order.quantity, cost_share: null, is_extra: false,
             unit_cost: order.status === 'completed' ? order.unit_cost : null,
             total_cost: order.status === 'completed' ? order.total_cost : null, product: order.product }]
        : []
    return { order, items: items ?? [], outputs: outputRows as any[] }
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
