/**
 * The analytics screen's aggregates; the dashboard and the sales reports have their own files.
 *
 * Same rules as `./index.ts` describes: cached, tagged, and filtered by `tenant_id` by hand.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { CACHE_TAGS } from './cache-tags'
import { orderDiscountFactors } from '@/lib/sales-discounts'

export const getCachedAnalyticsStats = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any

    const [
      { data: orderItems },
      { data: salesOrders },
    ] = await Promise.all([
      supabase
        .from('sales_order_items')
        .select('order_id, quantity, unit_price, unit_cost, total_price, products(name, cost_price, price), sales_orders(order_date, status, discount_amount)')
        .eq('tenant_id', tenantId),
      supabase
        .from('sales_orders')
        .select('id, total_amount, order_date, status')
        .eq('tenant_id', tenantId)
        .order('order_date', { ascending: true }),
    ])

    // Cancelled orders are excluded from every figure below — revenue, order
    // count, the monthly chart and the per-product table. They were reversed
    // out of stock and (where an invoice existed) out of receivables, so
    // counting them would report money that was never earned.
    const liveOrders = (salesOrders ?? []).filter((o: any) => o.status !== 'cancelled')
    const liveOrderItems = (orderItems ?? []).filter(
      (item: any) => item.sales_orders?.status !== 'cancelled'
    )
    const totalOrders = liveOrders.length

    // Aggregate sold products for the analytics table. Each sale of the same
    // product can carry a different realized unit_cost (that's the entire point
    // of FIFO/LIFO/AVECO — later sales draw from different cost layers), so cost
    // must accumulate per line (`quantity * costPrice` summed across every sale),
    // never a single costPrice from whichever line happened to be seen first
    // multiplied by the product's total quantity.
    const productMap: Record<string, { name: string; totalCost: number; sellingPrice: number; quantity: number; totalSum: number }> = {}
    // Line revenue has to be taken net of each order's general discount, or the
    // analytics revenue/profit exceed what was actually collected. Computed once
    // here and carried on the row as `net_total_price`, because the client
    // re-aggregates these same rows per period (analytics-client.tsx).
    const itemDiscountFactors = orderDiscountFactors(
      liveOrderItems.map((item: any) => ({
        order_id: item.order_id,
        total_price: item.total_price,
        discount_amount: item.sales_orders?.discount_amount,
      }))
    )
    const itemsWithNetRevenue = liveOrderItems.map((item: any) => ({
      ...item,
      net_total_price: (Number(item.total_price) || 0) * (itemDiscountFactors.get(item.order_id) ?? 1),
    }))
    itemsWithNetRevenue.forEach((item: any) => {
      const productName = item.products?.name ?? 'Unknown'
      // Realized cost at time of sale (FIFO/LIFO/AVECO) when available; falls back to
      // the product's current cost_price for sales made before this column existed.
      const costPrice = item.unit_cost ?? item.products?.cost_price ?? 0
      const sellingPrice = item.unit_price ?? item.products?.price ?? 0

      if (!productMap[productName]) {
        productMap[productName] = {
          name: productName,
          totalCost: 0,
          sellingPrice,
          quantity: 0,
          totalSum: 0,
        }
      }
      productMap[productName].quantity += item.quantity
      productMap[productName].totalSum += item.net_total_price
      productMap[productName].totalCost += costPrice * item.quantity
    })

    const aggregatedProducts = Object.values(productMap).map(p => ({
      ...p,
      // Weighted-average cost across every sale, for display only — profit
      // itself is computed from the accumulated totalCost, not this average.
      costPrice: p.quantity > 0 ? p.totalCost / p.quantity : 0,
      profit: p.totalSum - p.totalCost,
    }))

    // Total metrics
    const totalRevenue = aggregatedProducts.reduce((sum, p) => sum + p.totalSum, 0)
    const totalCost = aggregatedProducts.reduce((sum, p) => sum + p.totalCost, 0)
    const totalProfit = totalRevenue - totalCost
    const totalSold = aggregatedProducts.reduce((sum, p) => sum + p.quantity, 0)
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0

    // Monthly data for chart
    const monthlyData: Record<string, { revenue: number; cost: number }> = {}
    ;liveOrders.forEach((o: any) => {
      const month = o.order_date?.slice(0, 7) ?? 'unknown'
      if (!monthlyData[month]) monthlyData[month] = { revenue: 0, cost: 0 }
      monthlyData[month].revenue += o.total_amount ?? 0
    })
    const chartData = Object.entries(monthlyData).map(([month, d]) => ({
      month,
      revenue: d.revenue,
    }))

    return {
      aggregatedProducts: aggregatedProducts.sort((a, b) => b.totalSum - a.totalSum),
      totalRevenue,
      totalProfit,
      totalSold,
      totalOrders,
      avgOrderValue,
      chartData,
      rawItems: itemsWithNetRevenue,
      rawOrders: liveOrders,
    }
  },
  ['analytics-stats'],
  {
    tags: [CACHE_TAGS.analytics, CACHE_TAGS.orderItems, CACHE_TAGS.orders, CACHE_TAGS.products],
    revalidate: 60,
  }
)
