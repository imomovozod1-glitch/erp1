/**
 * Products, categories, stock movements and units.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { queryPage, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

export const getCachedProducts = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['products-list'],
  { tags: [CACHE_TAGS.products, CACHE_TAGS.categories], revalidate: 60 }
)

export const getCachedCategories = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['categories-list'],
  { tags: [CACHE_TAGS.categories], revalidate: 60 }
)

export const getCachedMovements = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('stock_movements')
      .select('*, products(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['movements-list'],
  { tags: [CACHE_TAGS.movements], revalidate: 30 }
)

/**
 * The two tenant-level settings the product form needs before it can render:
 * the configurable unit-of-measurement list and the costing method.
 *
 * Same story as above — two `useEffect` round trips after hydration for values
 * that change about once a year.
 */
/** The tenant's configurable unit-of-measurement list, for the settings screen. */
export const getCachedMeasurementUnits = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('measurement_units')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
    return (data ?? []) as { id: string; name: string }[]
  },
  ['measurement-units'],
  { tags: ['measurement_units'], revalidate: 120 }
)

export const getCachedProductFormOptions = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const [units, tenant, skus] = await Promise.all([
      supabase.from('measurement_units').select('name').eq('tenant_id', tenantId).order('name'),
      supabase.from('tenants').select('costing_method').eq('id', tenantId).maybeSingle(),
      // Only the sku column, and only on the server: the form used to pull
      // EVERY product's sku into the browser on mount purely to work out
      // max + 1. `products.sku` is UNIQUE and the numbering is not gap-free, so
      // there is no cheaper query than scanning the column — but the browser
      // never needs to see it, and the result is one string, cached.
      supabase.from('products').select('sku').eq('tenant_id', tenantId),
    ])

    let maxSku = 1000
    for (const row of skus.data ?? []) {
      const parsed = Number.parseInt(row.sku, 10)
      if (Number.isFinite(parsed) && parsed > maxSku) maxSku = parsed
    }

    return {
      units: (units.data ?? []).map((u: any) => u.name as string),
      costingMethod: (tenant.data?.costing_method ?? null) as string | null,
      nextSku: String(maxSku + 1),
    }
  },
  ['product-form-options'],
  // Tagged with `products` as well as its own inputs: the suggested sku must
  // not survive the creation of the product that just took it.
  { tags: ['measurement_units', CACHE_TAGS.tenants, CACHE_TAGS.products], revalidate: 120 }
)

export const getCachedCategoriesForSelect = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('categories')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['categories-select'],
  { tags: [CACHE_TAGS.categories], revalidate: 120 }
)

// Deliberately NOT wrapped in unstable_cache: this only powers the product picker on
// the rarely-visited "new sales order"/"new purchase order" pages, where a stale list
// (e.g. missing a product created seconds ago) is actively harmful and an extra DB
// round-trip is free. Tag-based invalidation of a cached version of this exact query
// was observed to not reliably pick up a just-created product, so it's simplest and
// most reliable to just not cache it at all here.
export async function getCachedProductsForSelect(tenantId: string) {
  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('products')
    .select('id, name, price, cost_price, stock, unit, sku')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')
  return (data ?? []) as { id: string; name: string; price: number; cost_price: number; stock: number; unit: string; sku: string }[]
}

export const getCachedProductDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    // `costing_method` on tenants postdates the generated Supabase types until
    // `database.types.ts` is regenerated — cast to `any` for that one column.
    const supabase = getCacheClient() as any
    const [
      { data: product },
      { data: movements },
      { data: salesOrderItems },
      { data: purchaseOrderItems },
      { data: costLayers },
      { data: tenant },
    ] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('id', id).eq('tenant_id', tenantId).single(),
      supabase.from('stock_movements').select('*').eq('product_id', id).eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('sales_order_items').select('quantity, total_price, sales_orders(order_number, order_date, created_at, status, customers(name))').eq('product_id', id).eq('tenant_id', tenantId),
      supabase.from('purchase_order_items').select('quantity, total_cost, purchase_orders(po_number, order_date, created_at, status, suppliers(name))').eq('product_id', id).eq('tenant_id', tenantId),
      supabase
        .from('inventory_cost_layers')
        .select('id, quantity, remaining_qty, unit_cost, source_type, received_at')
        .eq('product_id', id)
        .eq('tenant_id', tenantId)
        .gt('remaining_qty', 0)
        .order('received_at', { ascending: true }),
      supabase.from('tenants').select('costing_method').eq('id', tenantId).single(),
    ])

    // Resolve where each movement came from: purchase order (+ supplier) or sales order (+ customer)
    const poIds = (movements ?? []).filter((m: any) => m.reference_type === 'purchase_order' && m.reference_id).map((m: any) => m.reference_id)
    const orderIds = (movements ?? []).filter((m: any) => m.reference_type === 'sales_orders' && m.reference_id).map((m: any) => m.reference_id)

    const [poRes, orderRes] = await Promise.all([
      poIds.length
        ? supabase.from('purchase_orders').select('id, po_number, suppliers(name)').in('id', poIds).eq('tenant_id', tenantId)
        : Promise.resolve({ data: [] }),
      orderIds.length
        ? supabase.from('sales_orders').select('id, order_number, customers(name)').in('id', orderIds).eq('tenant_id', tenantId)
        : Promise.resolve({ data: [] }),
    ])

    const poMap = new Map((poRes.data ?? []).map((po: any) => [po.id, po]))
    const orderMap = new Map((orderRes.data ?? []).map((o: any) => [o.id, o]))

    const enrichedMovements = (movements ?? []).map((m: any) => {
      let source: { type: string; label: string; supplierOrCustomer?: string } | null = null
      if (m.reference_type === 'purchase_order' && poMap.has(m.reference_id)) {
        const po: any = poMap.get(m.reference_id)
        source = { type: 'purchase_order', label: po.po_number, supplierOrCustomer: po.suppliers?.name }
      } else if (m.reference_type === 'sales_orders' && orderMap.has(m.reference_id)) {
        const o: any = orderMap.get(m.reference_id)
        source = { type: 'sales_orders', label: o.order_number, supplierOrCustomer: o.customers?.name }
      } else if (m.reference_type === 'initial_stock') {
        source = { type: 'initial_stock', label: '' }
      } else if (m.reference_type === 'product_adjustment') {
        source = { type: 'product_adjustment', label: '' }
      }
      return { ...m, source }
    })

    const layers: any[] = costLayers ?? []
    const effectiveMethod: string = (tenant as any)?.costing_method ?? 'fifo'

    // What the *next* sale would actually be charged under the active method — can
    // differ from products.cost_price (a blended average) under FIFO/LIFO.
    let nextSaleCost: number | null = null
    if (layers.length > 0) {
      if (effectiveMethod === 'lifo') {
        nextSaleCost = Number(layers[layers.length - 1].unit_cost)
      } else if (effectiveMethod === 'fifo') {
        nextSaleCost = Number(layers[0].unit_cost)
      } else {
        const totalQty = layers.reduce((sum: number, l: any) => sum + Number(l.remaining_qty), 0)
        nextSaleCost = totalQty > 0
          ? layers.reduce((sum: number, l: any) => sum + Number(l.remaining_qty) * Number(l.unit_cost), 0) / totalQty
          : null
      }
    }

    return {
      product,
      movements: enrichedMovements,
      sales: salesOrderItems ?? [],
      purchases: purchaseOrderItems ?? [],
      costLayers: layers,
      effectiveCostingMethod: effectiveMethod,
      nextSaleCost,
    }
  },
  ['product-details-by-id'],
  {
    tags: [CACHE_TAGS.products, CACHE_TAGS.movements, CACHE_TAGS.orders, CACHE_TAGS.purchaseOrders, CACHE_TAGS.tenants],
    revalidate: 30,
  }
)

export function getProductsPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; status?: 'all' | 'active' | 'inactive'; ownerId?: string }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'products',
    tenantId,
    select: '*, categories(name), creator:profiles!products_created_by_fkey(full_name), assignee:profiles!products_assigned_to_fkey(full_name)',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['name', 'sku'],
    filters: { is_active: opts.status === 'all' || !opts.status ? undefined : opts.status === 'active' },
    orderBy: { column: 'created_at', ascending: false },
    ownerId: opts.ownerId,
  })
}

export function getMovementsPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'stock_movements',
    tenantId,
    select: '*, products(name)',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['reason'],
    orderBy: { column: 'created_at', ascending: false },
  })
}
