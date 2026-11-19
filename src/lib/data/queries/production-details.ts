/** One composition's or production run's detail page. */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { CACHE_TAGS } from './cache-tags'
import { BOM_SELECT, ORDER_SELECT } from './production'

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
