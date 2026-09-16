/**
 * Suppliers and purchase orders.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { queryPage, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

export const getCachedSuppliers = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['suppliers-list'],
  { tags: [CACHE_TAGS.suppliers], revalidate: 60 }
)

export const getCachedPurchaseOrders = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['purchase-orders-list'],
  { tags: [CACHE_TAGS.purchaseOrders, CACHE_TAGS.suppliers], revalidate: 30 }
)

export const getCachedSuppliersForSelect = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['suppliers-select'],
  { tags: [CACHE_TAGS.suppliers], revalidate: 120 }
)

export const getCachedSupplierById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    return data
  },
  ['supplier-by-id'],
  { tags: [CACHE_TAGS.suppliers], revalidate: 60 }
)

export const getCachedSupplierDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [
      { data: supplier },
      { data: purchaseOrders },
      { data: transactions },
    ] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', id).eq('tenant_id', tenantId).single(),
      supabase.from('purchase_orders').select('*, purchase_order_items(received_qty, unit_cost)').eq('supplier_id', id).eq('tenant_id', tenantId).order('order_date', { ascending: false }),
      supabase.from('transactions').select('*').eq('supplier_id', id).eq('tenant_id', tenantId).order('transaction_date', { ascending: false }),
    ])

    return {
      supplier,
      purchaseOrders: purchaseOrders ?? [],
      transactions: transactions ?? [],
    }
  },
  ['supplier-details-by-id'],
  { tags: [CACHE_TAGS.suppliers, CACHE_TAGS.purchaseOrders, CACHE_TAGS.transactions], revalidate: 30 }
)

export function getSuppliersPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; ownerId?: string }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'suppliers',
    tenantId,
    select: '*, creator:profiles!suppliers_created_by_fkey(full_name), assignee:profiles!suppliers_assigned_to_fkey(full_name)',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['name', 'email', 'phone'],
    orderBy: { column: 'created_at', ascending: false },
    ownerId: opts.ownerId,
  })
}

export function getPurchaseOrdersPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; ownerId?: string }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'purchase_orders',
    tenantId,
    select: '*, suppliers(name), creator:profiles!purchase_orders_created_by_fkey(full_name), assignee:profiles!purchase_orders_assigned_to_fkey(full_name)',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['po_number'],
    orderBy: { column: 'created_at', ascending: false },
    ownerId: opts.ownerId,
  })
}
