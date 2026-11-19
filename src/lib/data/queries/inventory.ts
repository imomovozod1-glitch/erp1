/**
 * Products, services, categories, stock movements and units.
 *
 * A service (`products.is_service = true`, migration_services.sql) lives in the
 * `products` table so a sale, invoice or receipt never has to know which of the
 * two it is holding. Everything here that feeds a PRODUCT screen — the list
 * page, the purchase-order picker, stock value, low stock — therefore has to
 * exclude them by hand; only selling includes both.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { queryPage, type PageResult, type OwnerFilter } from '@/lib/data/paginate'
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

/** One page of the categories list (Ombor > Kategoriyalar), searched by name and slug. */
export function getCategoriesPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'categories',
    tenantId,
    select: '*',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['name', 'slug', 'description'],
    orderBy: { column: 'created_at', ascending: false },
  })
}

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

const nextSkuAfter = (rows: { sku: string }[]) =>
  String(rows.reduce((max, row) => Math.max(max, Number.parseInt(row.sku, 10) || 0), 1000) + 1)

/**
 * The next free numeric sku, read fresh: a cached suggestion outlived the product that
 * took it, so two products created in a row collided on the same sku.
 */
export async function getNextProductSku(tenantId: string) {
  const { data } = await (getCacheClient() as any).from('products').select('sku').eq('tenant_id', tenantId)
  return nextSkuAfter(data ?? [])
}

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

    return {
      units: (units.data ?? []).map((u: any) => u.name as string),
      costingMethod: (tenant.data?.costing_method ?? null) as string | null,
      nextSku: nextSkuAfter(skus.data ?? []),
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
export async function getCachedProductsForSelect(
  tenantId: string,
  // Services are sellable but not purchasable or countable, so they belong in
  // the sales picker and nowhere else. Excluded by default: a caller that
  // forgets to think about it gets goods only, which is always safe.
  opts: { includeServices?: boolean } = {}
) {
  const supabase = getCacheClient() as any
  let query = supabase
    .from('products')
    .select('id, name, price, cost_price, stock, unit, sku, is_service')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
  if (!opts.includeServices) query = query.eq('is_service', false)
  const { data } = await query.order('name')
  return (data ?? []) as { id: string; name: string; price: number; cost_price: number; stock: number; unit: string; sku: string; is_service: boolean }[]
}


export function getProductsPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; status?: 'all' | 'active' | 'inactive'; ownerId?: OwnerFilter }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'products',
    tenantId,
    select: '*, categories(name), creator:profiles!products_created_by_fkey(full_name), assignee:profiles!products_assigned_to_fkey(full_name)',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['name', 'sku'],
    filters: {
      is_active: opts.status === 'all' || !opts.status ? undefined : opts.status === 'active',
      is_service: false,
    },
    orderBy: { column: 'created_at', ascending: false },
    ownerId: opts.ownerId,
  })
}

/**
 * The services list (Ombor > Xizmatlar) — the same query as `getProductsPage`
 * against the other half of the table. Stock columns are left out of the select
 * only in the sense that nothing reads them: a service's are pinned at zero.
 */
export function getServicesPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; status?: 'all' | 'active' | 'inactive'; ownerId?: OwnerFilter }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'products',
    tenantId,
    select: '*, categories(name), creator:profiles!products_created_by_fkey(full_name), assignee:profiles!products_assigned_to_fkey(full_name)',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['name', 'sku'],
    filters: {
      is_active: opts.status === 'all' || !opts.status ? undefined : opts.status === 'active',
      is_service: true,
    },
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
