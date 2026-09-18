/**
 * Cross-domain aggregates: the dashboard tiles, the analytics screen
 * and the one raw read the five sales reports are built from.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { CACHE_TAGS } from './cache-tags'
import { SUPPLIER_ORDER_COLUMNS, totalPayables as sumPayables } from '@/lib/supplier-debt'
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
        .select('id, name, sku, stock, price, cost_price, is_active')
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

export const getCachedDashboardStats = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const [
      { count: totalOrders },
      { count: totalProducts },
      { count: totalCustomers },
      { count: totalEmployees },
      { count: totalSuppliers },
      { data: recentOrders },
      { data: chartTxData },
      { data: allTxAmounts },
      { data: lowStockRows },
      { count: pendingInvoices },
      cashboxesRes,
      allProductsRes,
      unpaidInvoicesRes,
      unpaidPurchaseOrdersRes,
      supplierPaymentsRes,
      soldItemsRes,
      costLayersRes,
    ] = await Promise.all([
      // Cancelled orders are not sales, so they don't belong in the order count.
      supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).neq('status', 'cancelled'),
      // Goods only: a service holds no stock, so it belongs in neither the
      // inventory headcount nor the two stock figures below (migration_services.sql).
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true).eq('is_service', false),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase
        .from('sales_orders')
        .select('id, order_number, status, total_amount, order_date, customers(name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('transactions')
        .select('amount, type, transaction_date')
        .eq('tenant_id', tenantId)
        .gte('transaction_date', sixMonthsAgo)
        .order('transaction_date', { ascending: true }),
      supabase.from('transactions').select('amount, type, transaction_date').eq('tenant_id', tenantId),
      supabase.from('products').select('id, name, sku, stock, min_stock').eq('tenant_id', tenantId).eq('is_service', false).order('stock', { ascending: true }).limit(10),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['sent', 'overdue']),
      supabase.from('cashboxes').select('balance').eq('tenant_id', tenantId),
      supabase.from('products').select('stock, cost_price').eq('tenant_id', tenantId).eq('is_active', true).eq('is_service', false),
      supabase.from('invoices').select('total_amount, paid_amount').eq('tenant_id', tenantId).not('status', 'in', '("paid","cancelled")'),
      supabase.from('purchase_orders').select(SUPPLIER_ORDER_COLUMNS).eq('tenant_id', tenantId).in('status', ['received', 'partially_received']),
      supabase.from('transactions').select('supplier_id, amount').eq('tenant_id', tenantId).eq('type', 'expense').not('supplier_id', 'is', null),
      supabase
        .from('sales_order_items')
        .select('order_id, quantity, total_price, unit_cost, products(cost_price), sales_orders(order_date, status, discount_amount)')
        .eq('tenant_id', tenantId),
      supabase.from('inventory_cost_layers').select('remaining_qty, unit_cost').eq('tenant_id', tenantId).gt('remaining_qty', 0),
    ])

    const incomeRows = (allTxAmounts ?? []).filter((tx: any) => tx.type === 'income')
    const expenseRows = (allTxAmounts ?? []).filter((tx: any) => tx.type === 'expense')

    const totalCashboxBalance = (cashboxesRes.data ?? []).reduce((sum: number, cb: any) => sum + (Number(cb.balance) || 0), 0)
    // FIFO/LIFO-correct valuation: sum what's actually left in each cost layer, not
    // stock * today's average cost_price (those can legitimately diverge once methods
    // differ per product). Falls back to the naive formula if no layers exist yet
    // (e.g. right before the costing migration has been run).
    const warehouseValue = (costLayersRes.data?.length ?? 0) > 0
      ? (costLayersRes.data ?? []).reduce((sum: number, l: any) => sum + (Number(l.remaining_qty) || 0) * (Number(l.unit_cost) || 0), 0)
      : (allProductsRes.data ?? []).reduce((sum: number, p: any) => sum + ((Number(p.stock) || 0) * (Number(p.cost_price) || 0)), 0)
    const totalReceivables = (unpaidInvoicesRes.data ?? []).reduce((sum: number, inv: any) => sum + ((Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0)), 0)
    // What we owe suppliers for goods received, supplier by supplier — see
    // src/lib/supplier-debt.ts.
    const totalPayables = sumPayables(unpaidPurchaseOrdersRes.data ?? [], supplierPaymentsRes.data ?? [])

    // Sold items with cost data, used to compute real profit (sales - cost price) per period.
    // Prefers the realized unit_cost charged at sale time (FIFO/LIFO/AVECO); falls back
    // to the product's current cost_price for sales made before that column existed.
    // Cancelled orders are excluded: they never became revenue, so counting them
    // would inflate both the sales total and the order count on the dashboard.
    const soldRows = (soldItemsRes.data ?? [])
      .filter((item: any) => item.sales_orders?.status !== 'cancelled')
    const soldDiscountFactors = orderDiscountFactors(
      soldRows.map((item: any) => ({
        order_id: item.order_id,
        total_price: item.total_price,
        discount_amount: item.sales_orders?.discount_amount,
      }))
    )
    const soldItems = soldRows
      .map((item: any) => ({
        order_id: item.order_id as string,
        order_date: item.sales_orders?.order_date ?? null,
        // Net of the order's general discount — see orderDiscountFactors.
        revenue: (Number(item.total_price) || 0) * (soldDiscountFactors.get(item.order_id) ?? 1),
        cost: (Number(item.unit_cost ?? item.products?.cost_price) || 0) * (Number(item.quantity) || 0),
      }))
      .filter((item: any) => item.order_date)

    return {
      totalOrders,
      totalProducts,
      totalCustomers,
      totalEmployees,
      totalSuppliers,
      recentOrders: recentOrders ?? [],
      chartTxData: chartTxData ?? [],
      incomeRows,
      expenseRows,
      lowStockRows: lowStockRows ?? [],
      pendingInvoices,
      totalCashboxBalance,
      warehouseValue,
      totalReceivables,
      totalPayables,
      soldItems,
    }
  },
  ['dashboard-stats'],
  {
    tags: [
      CACHE_TAGS.dashboard,
      CACHE_TAGS.orders,
      CACHE_TAGS.products,
      CACHE_TAGS.customers,
      CACHE_TAGS.employees,
      CACHE_TAGS.suppliers,
      CACHE_TAGS.transactions,
      CACHE_TAGS.invoices,
    ],
    revalidate: 60,
  }
)
