/**
 * The one raw read the five sales reports are built from.
 *
 * Same rules as `./index.ts` describes: cached, tagged, and filtered by `tenant_id` by hand.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { CACHE_TAGS } from './cache-tags'
import { orderDiscountFactors } from '@/lib/sales-discounts'

/**
 * Everything the Reports module's five sales reports are built from, in one
 * cached read.
 *
 * Deliberately raw: it returns the sale lines and the sale headers, with the
 * seller and customer *names* already resolved, and leaves every aggregation
 * to the client. The reports all slice the same underlying sales — by day, by
 * seller, by customer, by product, by revenue share — and pre-aggregating on
 * the server would have meant five near-identical queries that re-fetch the
 * same rows the moment a user changes the period. One query, one cache entry,
 * five views.
 *
 * The names come from separate lookups rather than PostgREST embeds because
 * `sales_orders` has TWO foreign keys into `profiles` (`created_by` and
 * `assigned_to`), which makes `profiles(full_name)` ambiguous and forces a
 * constraint-name hint that silently breaks if the constraint is ever renamed.
 * Two extra small selects are cheaper than that fragility.
 */
export const getCachedSalesReportData = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any

    const [
      { data: orderItems },
      { data: salesOrders },
      { data: profiles },
      { data: customers },
      { data: products },
    ] = await Promise.all([
      supabase
        .from('sales_order_items')
        .select('order_id, product_id, quantity, unit_price, unit_cost, total_price, products(name, sku), sales_orders(order_date, status, discount_amount, customer_id, created_by)')
        .eq('tenant_id', tenantId),
      supabase
        .from('sales_orders')
        .select('id, order_number, total_amount, order_date, status, customer_id, created_by')
        .eq('tenant_id', tenantId)
        .order('order_date', { ascending: true }),
      supabase.from('profiles').select('id, full_name').eq('tenant_id', tenantId),
      supabase.from('customers').select('id, name').eq('tenant_id', tenantId),
      // The catalogue is needed in full, not just the products that sold: the
      // products report's whole point is the ones that DIDN'T.
      supabase
        .from('products')
        // `is_service` comes along so the reports that are about STOCK can drop
        // them; the revenue reports keep them, because a sold service is a sale.
        .select('id, name, sku, stock, price, cost_price, is_active, is_service')
        .eq('tenant_id', tenantId),
    ])

    const sellerNames = new Map<string, string>(
      (profiles ?? []).map((p: any) => [p.id, p.full_name ?? ''])
    )
    const customerNames = new Map<string, string>(
      (customers ?? []).map((c: any) => [c.id, c.name ?? ''])
    )

    // Cancelled sales are excluded everywhere, exactly as in
    // getCachedAnalyticsStats: they were reversed out of stock and out of
    // receivables, so counting them reports money that was never earned.
    const liveOrders = (salesOrders ?? []).filter((o: any) => o.status !== 'cancelled')
    const liveItems = (orderItems ?? []).filter(
      (item: any) => item.sales_orders?.status !== 'cancelled'
    )

    const factors = orderDiscountFactors(
      liveItems.map((item: any) => ({
        order_id: item.order_id,
        total_price: item.total_price,
        discount_amount: item.sales_orders?.discount_amount,
      }))
    )

    const items = liveItems.map((item: any) => ({
      order_id: item.order_id as string,
      product_id: (item.product_id ?? null) as string | null,
      product_name: (item.products?.name ?? '') as string,
      sku: (item.products?.sku ?? '') as string,
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      // Realized cost at the time of sale (FIFO/LIFO/AVECO). Sales predating
      // the column fall back to nothing rather than to today's cost price,
      // which would misreport historic margin as today's.
      unit_cost: Number(item.unit_cost) || 0,
      // Net of the order's general discount — see orderDiscountFactors.
      revenue: (Number(item.total_price) || 0) * (factors.get(item.order_id) ?? 1),
      order_date: (item.sales_orders?.order_date ?? null) as string | null,
      customer_id: (item.sales_orders?.customer_id ?? null) as string | null,
      seller_id: (item.sales_orders?.created_by ?? null) as string | null,
    }))

    const orders = liveOrders.map((o: any) => ({
      id: o.id as string,
      order_number: (o.order_number ?? '') as string,
      order_date: (o.order_date ?? null) as string | null,
      total_amount: Number(o.total_amount) || 0,
      customer_id: (o.customer_id ?? null) as string | null,
      customer_name: customerNames.get(o.customer_id) || '',
      seller_id: (o.created_by ?? null) as string | null,
      seller_name: sellerNames.get(o.created_by) || '',
    }))

    return {
      orders,
      items,
      products: (products ?? []).map((p: any) => ({
        id: p.id as string,
        name: (p.name ?? '') as string,
        sku: (p.sku ?? '') as string,
        stock: Number(p.stock) || 0,
        price: Number(p.price) || 0,
        cost_price: Number(p.cost_price) || 0,
        is_active: p.is_active !== false,
      })),
    }
  },
  ['sales-report-data'],
  {
    tags: [
      CACHE_TAGS.analytics,
      CACHE_TAGS.orderItems,
      CACHE_TAGS.orders,
      CACHE_TAGS.products,
      CACHE_TAGS.customers,
    ],
    revalidate: 60,
  }
)

export type SalesReportData = Awaited<ReturnType<typeof getCachedSalesReportData>>
