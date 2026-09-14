/**
 * Sales orders and invoices.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { queryPage, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

export const getCachedOrders = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('sales_orders')
      .select('*, customers(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['orders-list'],
  { tags: [CACHE_TAGS.orders, CACHE_TAGS.customers], revalidate: 30 }
)

export const getCachedInvoices = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(name), sales_orders(order_number)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['invoices-list'],
  { tags: [CACHE_TAGS.invoices, CACHE_TAGS.customers], revalidate: 30 }
)

export const getCachedSoldProducts = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('sales_order_items')
      .select('id, quantity, unit_price, unit_cost, total_price, products(id, name, cost_price, price, sku), sales_orders(id, order_number, status, order_date)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    // A cancelled order's lines are not sales: the goods went back into stock
    // (see cancelSalesOrder in src/lib/status-actions.ts), so leaving them in
    // would report revenue and quantities that were undone.
    return (data ?? []).filter((row: any) => row.sales_orders?.status !== 'cancelled')
  },
  ['sold-products-list'],
  { tags: [CACHE_TAGS.orderItems, CACHE_TAGS.products, CACHE_TAGS.orders], revalidate: 30 }
)

export const getCachedOrderById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('sales_orders')
      .select('*, customers(name), creator:profiles!sales_orders_created_by_fkey(full_name), assignee:profiles!sales_orders_assigned_to_fkey(full_name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    return data
  },
  ['order-by-id'],
  { tags: [CACHE_TAGS.orders, CACHE_TAGS.customers], revalidate: 30 }
)

export const getCachedInvoiceById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(name), sales_orders(order_number), creator:profiles!invoices_created_by_fkey(full_name), assignee:profiles!invoices_assigned_to_fkey(full_name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    return data
  },
  ['invoice-by-id'],
  { tags: [CACHE_TAGS.invoices], revalidate: 30 }
)

export function getOrdersPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; ownerId?: string }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'sales_orders',
    tenantId,
    select: '*, customers(name), creator:profiles!sales_orders_created_by_fkey(full_name), assignee:profiles!sales_orders_assigned_to_fkey(full_name)',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['order_number'],
    orderBy: { column: 'created_at', ascending: false },
    ownerId: opts.ownerId,
  })
}

export function getInvoicesPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; ownerId?: string }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'invoices',
    tenantId,
    select: '*, customers(name), sales_orders(order_number), creator:profiles!invoices_created_by_fkey(full_name), assignee:profiles!invoices_assigned_to_fkey(full_name)',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['invoice_number'],
    orderBy: { column: 'created_at', ascending: false },
    ownerId: opts.ownerId,
  })
}
