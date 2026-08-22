/**
 * Centralized server-side data fetching with Next.js cache.
 *
 * Strategy:
 * - `unstable_cache` wraps every Supabase query → result is stored in the
 *   Next.js Data Cache (persisted across requests, not just one render).
 * - Each function is tagged so we can precisely invalidate only the data
 *   that changed (e.g. revalidateTag('products') after a create/update/delete).
 * - TTL (revalidate) is set conservatively so stale data is never shown for
 *   long even if a revalidation call is missed.
 *
 * Multi-tenancy: `getCacheClient()` uses the Supabase *service-role* key
 * (RLS bypassed) because `unstable_cache` callbacks can't call `cookies()`
 * to carry a user's JWT. That means every function below must filter by
 * `tenant_id` explicitly — RLS alone does not protect these reads. Every
 * exported function therefore takes a `tenantId` argument, which Next.js
 * automatically folds into the cache key (no manual key editing needed —
 * see `getCachedProfile` in `src/lib/auth.ts` for the established pattern
 * this follows). Callers resolve it via `getCurrentTenantId()` in
 * `src/lib/tenant.ts`.
 *
 * Usage in Server Components:
 *   import { getCachedProducts } from '@/lib/data/queries'
 *   import { getCurrentTenantId } from '@/lib/tenant'
 *   const tenantId = await getCurrentTenantId()
 *   const products = await getCachedProducts(tenantId)
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'

// ─── Cache tags ────────────────────────────────────────────────────────────────
export const CACHE_TAGS = {
  products: 'products',
  categories: 'categories',
  movements: 'stock_movements',
  orders: 'sales_orders',
  orderItems: 'sales_order_items',
  customers: 'customers',
  invoices: 'invoices',
  employees: 'employees',
  departments: 'departments',
  suppliers: 'suppliers',
  purchaseOrders: 'purchase_orders',
  transactions: 'transactions',
  transactionCategories: 'transaction_categories',
  customerCategories: 'customer_categories',
  dashboard: 'dashboard',
  analytics: 'analytics',
  cashbox: 'cashbox',
  tenants: 'tenants',
} as const

// ─── Inventory ─────────────────────────────────────────────────────────────────

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

// ─── Sales ─────────────────────────────────────────────────────────────────────

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

export const getCachedCustomers = unstable_cache(
  async (tenantId: string) => {
    // `customer_categories` postdates the generated Supabase types (only exists once
    // the customer-categories migration has been run) — cast to `any` until
    // `database.types.ts` is regenerated against the live schema.
    const supabase = getCacheClient() as any
    const [{ data: customers }, { data: unpaidInvoices }] = await Promise.all([
      supabase.from('customers').select('*, customer_categories(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('invoices').select('customer_id, total_amount, paid_amount').eq('tenant_id', tenantId).not('status', 'in', '("paid","cancelled")'),
    ])

    const debtByCustomer = new Map<string, number>()
    for (const inv of unpaidInvoices ?? []) {
      if (!inv.customer_id) continue
      const outstanding = (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0)
      debtByCustomer.set(inv.customer_id, (debtByCustomer.get(inv.customer_id) || 0) + outstanding)
    }

    return (customers ?? []).map((c: any) => ({ ...c, total_debt: debtByCustomer.get(c.id) || 0 }))
  },
  ['customers-list'],
  { tags: [CACHE_TAGS.customers, CACHE_TAGS.invoices, CACHE_TAGS.customerCategories], revalidate: 60 }
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

// ─── HR ────────────────────────────────────────────────────────────────────────

export const getCachedEmployees = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('employees')
      .select('*, profiles(full_name, email, avatar_url, departments!fk_profiles_department(name))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['employees-list'],
  { tags: [CACHE_TAGS.employees, CACHE_TAGS.departments], revalidate: 60 }
)

export const getCachedDepartments = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['departments-list'],
  { tags: [CACHE_TAGS.departments], revalidate: 120 }
)

// ─── Procurement ───────────────────────────────────────────────────────────────

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

// ─── Finance ───────────────────────────────────────────────────────────────────

export const getCachedTransactions = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['transactions-list'],
  { tags: [CACHE_TAGS.transactions], revalidate: 30 }
)

export const getCachedTransactionCategories = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('transaction_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['transaction-categories-list'],
  { tags: [CACHE_TAGS.transactionCategories], revalidate: 120 }
)

// ─── Analytics ─────────────────────────────────────────────────────────────────

export const getCachedSoldProducts = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('sales_order_items')
      .select('id, quantity, unit_price, unit_cost, total_price, products(id, name, cost_price, price, sku), sales_orders(id, order_number, status, order_date)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['sold-products-list'],
  { tags: [CACHE_TAGS.orderItems, CACHE_TAGS.products, CACHE_TAGS.orders], revalidate: 30 }
)

export const getCachedAnalyticsStats = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any

    const [
      { data: orderItems },
      { data: salesOrders },
    ] = await Promise.all([
      supabase
        .from('sales_order_items')
        .select('quantity, unit_price, unit_cost, total_price, products(name, cost_price, price), sales_orders(order_date, status)')
        .eq('tenant_id', tenantId),
      supabase
        .from('sales_orders')
        .select('id, total_amount, order_date, status')
        .eq('tenant_id', tenantId)
        .order('order_date', { ascending: true }),
    ])

    const totalOrders = salesOrders?.length ?? 0

    // Aggregate sold products for the analytics table. Each sale of the same
    // product can carry a different realized unit_cost (that's the entire point
    // of FIFO/LIFO/AVECO — later sales draw from different cost layers), so cost
    // must accumulate per line (`quantity * costPrice` summed across every sale),
    // never a single costPrice from whichever line happened to be seen first
    // multiplied by the product's total quantity.
    const productMap: Record<string, { name: string; totalCost: number; sellingPrice: number; quantity: number; totalSum: number }> = {}
    ;(orderItems ?? []).forEach((item: any) => {
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
      productMap[productName].totalSum += item.total_price
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
    ;(salesOrders ?? []).forEach((o: any) => {
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
      rawItems: orderItems ?? [],
      rawOrders: salesOrders ?? [],
    }
  },
  ['analytics-stats'],
  {
    tags: [CACHE_TAGS.analytics, CACHE_TAGS.orderItems, CACHE_TAGS.orders, CACHE_TAGS.products],
    revalidate: 60,
  }
)

// ─── Dashboard stats (heavier query, shorter cache) ───────────────────────────

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
      supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
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
      supabase.from('products').select('id, name, sku, stock, min_stock').eq('tenant_id', tenantId).order('stock', { ascending: true }).limit(10),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['sent', 'overdue']),
      supabase.from('cashboxes').select('balance').eq('tenant_id', tenantId),
      supabase.from('products').select('stock, cost_price').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('invoices').select('total_amount, paid_amount').eq('tenant_id', tenantId).not('status', 'in', '("paid","cancelled")'),
      supabase.from('purchase_orders').select('total_amount').eq('tenant_id', tenantId).neq('status', 'cancelled'),
      supabase.from('transactions').select('amount').eq('tenant_id', tenantId).eq('type', 'expense').not('supplier_id', 'is', null),
      supabase
        .from('sales_order_items')
        .select('quantity, total_price, unit_cost, products(cost_price), sales_orders(order_date)')
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
    // purchase_orders has no paid_amount column (unlike invoices), so "what we still
    // owe suppliers" is every non-cancelled PO's total minus every supplier payment
    // ever made — the same formula used on the supplier detail page.
    const totalPurchaseOrders = (unpaidPurchaseOrdersRes.data ?? []).reduce((sum: number, po: any) => sum + (Number(po.total_amount) || 0), 0)
    const totalSupplierPayments = (supplierPaymentsRes.data ?? []).reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)
    const totalPayables = totalPurchaseOrders - totalSupplierPayments

    // Sold items with cost data, used to compute real profit (sales - cost price) per period.
    // Prefers the realized unit_cost charged at sale time (FIFO/LIFO/AVECO); falls back
    // to the product's current cost_price for sales made before that column existed.
    const soldItems = (soldItemsRes.data ?? []).map((item: any) => ({
      order_date: item.sales_orders?.order_date ?? null,
      revenue: Number(item.total_price) || 0,
      cost: (Number(item.unit_cost ?? item.products?.cost_price) || 0) * (Number(item.quantity) || 0),
    })).filter((item: any) => item.order_date)

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

// ─── Form select options (very stable data) ───────────────────────────────────

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

export const getCachedDepartmentsForSelect = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['departments-select'],
  { tags: [CACHE_TAGS.departments], revalidate: 120 }
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

export const getCachedCustomersForSelect = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['customers-select'],
  { tags: [CACHE_TAGS.customers], revalidate: 120 }
)

export const getCachedCustomerCategories = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('customer_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['customer-categories-list'],
  { tags: [CACHE_TAGS.customerCategories], revalidate: 60 }
)

export const getCachedCustomerById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('customers')
      .select('*, customer_categories(name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    return data
  },
  ['customer-by-id'],
  { tags: [CACHE_TAGS.customers, CACHE_TAGS.customerCategories], revalidate: 60 }
)

export const getCachedOrderById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('sales_orders')
      .select('*, customers(name)')
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
      .select('*, customers(name), sales_orders(order_number)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    return data
  },
  ['invoice-by-id'],
  { tags: [CACHE_TAGS.invoices], revalidate: 30 }
)

export const getCachedTransactionById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    return data
  },
  ['transaction-by-id'],
  { tags: [CACHE_TAGS.transactions], revalidate: 30 }
)

export const getCachedEmployeeById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw error
    return data
  },
  ['employee-by-id'],
  { tags: [CACHE_TAGS.employees], revalidate: 3600 }
)

export const getCachedDepartmentById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw error
    return data
  },
  ['department-by-id'],
  { tags: [CACHE_TAGS.departments], revalidate: 3600 }
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

export const getCachedEmployeeDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data: employee } = await supabase
      .from('employees')
      .select('*, profiles(*, departments!fk_profiles_department(name))')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (!employee) return null
    const profileId = employee.profile_id

    const [
      { data: transactions },
      { data: salesOrders },
    ] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('employee_id', id)
        .eq('tenant_id', tenantId)
        .order('transaction_date', { ascending: false }),
      profileId
        ? supabase
            .from('sales_orders')
            .select('*, customers(name)')
            .eq('created_by', profileId)
            .eq('tenant_id', tenantId)
            .order('order_date', { ascending: false })
        : Promise.resolve({ data: [] })
    ])

    return {
      employee,
      transactions: transactions ?? [],
      salesOrders: salesOrders ?? [],
    }
  },
  ['employee-details-by-id'],
  { tags: [CACHE_TAGS.employees, CACHE_TAGS.transactions, CACHE_TAGS.orders], revalidate: 30 }
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
      supabase.from('purchase_orders').select('*').eq('supplier_id', id).eq('tenant_id', tenantId).order('order_date', { ascending: false }),
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

export const getCachedCustomerDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const [
      { data: customer },
      { data: salesOrders },
      { data: invoices },
      { data: transactions },
    ] = await Promise.all([
      supabase.from('customers').select('*, customer_categories(name)').eq('id', id).eq('tenant_id', tenantId).single(),
      supabase.from('sales_orders').select('*').eq('customer_id', id).eq('tenant_id', tenantId).order('order_date', { ascending: false }),
      supabase.from('invoices').select('*').eq('customer_id', id).eq('tenant_id', tenantId).order('issued_at', { ascending: false }),
      supabase.from('transactions').select('*').eq('customer_id', id).eq('tenant_id', tenantId).order('transaction_date', { ascending: false }),
    ])

    return {
      customer,
      salesOrders: salesOrders ?? [],
      invoices: invoices ?? [],
      transactions: transactions ?? [],
    }
  },
  ['customer-details-by-id'],
  { tags: [CACHE_TAGS.customers, CACHE_TAGS.orders, CACHE_TAGS.invoices, CACHE_TAGS.transactions, CACHE_TAGS.customerCategories], revalidate: 30 }
)
