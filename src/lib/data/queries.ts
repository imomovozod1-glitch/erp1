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
 * Usage in Server Components:
 *   import { getCachedProducts } from '@/lib/data/queries'
 *   const products = await getCachedProducts()
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
  dashboard: 'dashboard',
  analytics: 'analytics',
  cashbox: 'cashbox',
} as const

// ─── Inventory ─────────────────────────────────────────────────────────────────

export const getCachedProducts = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['products-list'],
  { tags: [CACHE_TAGS.products, CACHE_TAGS.categories], revalidate: 60 }
)

export const getCachedCategories = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['categories-list'],
  { tags: [CACHE_TAGS.categories], revalidate: 60 }
)

export const getCachedMovements = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('stock_movements')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['movements-list'],
  { tags: [CACHE_TAGS.movements], revalidate: 30 }
)

// ─── Sales ─────────────────────────────────────────────────────────────────────

export const getCachedOrders = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('sales_orders')
      .select('*, customers(name)')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['orders-list'],
  { tags: [CACHE_TAGS.orders, CACHE_TAGS.customers], revalidate: 30 }
)

export const getCachedCustomers = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['customers-list'],
  { tags: [CACHE_TAGS.customers], revalidate: 60 }
)

export const getCachedInvoices = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(name), sales_orders(order_number)')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['invoices-list'],
  { tags: [CACHE_TAGS.invoices, CACHE_TAGS.customers], revalidate: 30 }
)

// ─── HR ────────────────────────────────────────────────────────────────────────

export const getCachedEmployees = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('employees')
      .select('*, profiles(full_name, email, avatar_url, departments!fk_profiles_department(name))')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['employees-list'],
  { tags: [CACHE_TAGS.employees, CACHE_TAGS.departments], revalidate: 60 }
)

export const getCachedDepartments = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('departments')
      .select('*')
      .order('name')
    return data ?? []
  },
  ['departments-list'],
  { tags: [CACHE_TAGS.departments], revalidate: 120 }
)

// ─── Procurement ───────────────────────────────────────────────────────────────

export const getCachedSuppliers = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['suppliers-list'],
  { tags: [CACHE_TAGS.suppliers], revalidate: 60 }
)

export const getCachedPurchaseOrders = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name)')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['purchase-orders-list'],
  { tags: [CACHE_TAGS.purchaseOrders, CACHE_TAGS.suppliers], revalidate: 30 }
)

// ─── Finance ───────────────────────────────────────────────────────────────────

export const getCachedTransactions = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['transactions-list'],
  { tags: [CACHE_TAGS.transactions], revalidate: 30 }
)

// ─── Analytics ─────────────────────────────────────────────────────────────────

export const getCachedSoldProducts = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('sales_order_items')
      .select('id, quantity, unit_price, total_price, products(id, name, cost_price, price, sku), sales_orders(id, order_number, status, order_date)')
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['sold-products-list'],
  { tags: [CACHE_TAGS.orderItems, CACHE_TAGS.products, CACHE_TAGS.orders], revalidate: 30 }
)

export const getCachedAnalyticsStats = unstable_cache(
  async () => {
    const supabase = getCacheClient()

    const [
      { data: orderItems },
      { data: salesOrders },
    ] = await Promise.all([
      supabase
        .from('sales_order_items')
        .select('quantity, unit_price, total_price, products(name, cost_price, price), sales_orders(order_date, status)'),
      supabase
        .from('sales_orders')
        .select('id, total_amount, order_date, status')
        .order('order_date', { ascending: true }),
    ])

    const totalOrders = salesOrders?.length ?? 0

    // Aggregate sold products for the analytics table
    const productMap: Record<string, { name: string; costPrice: number; sellingPrice: number; quantity: number; totalSum: number }> = {}
    ;(orderItems ?? []).forEach((item: any) => {
      const productName = item.products?.name ?? 'Unknown'
      const costPrice = item.products?.cost_price ?? 0
      const sellingPrice = item.unit_price ?? item.products?.price ?? 0

      if (!productMap[productName]) {
        productMap[productName] = {
          name: productName,
          costPrice,
          sellingPrice,
          quantity: 0,
          totalSum: 0,
        }
      }
      productMap[productName].quantity += item.quantity
      productMap[productName].totalSum += item.total_price
    })

    const aggregatedProducts = Object.values(productMap).map(p => ({
      ...p,
      profit: p.totalSum - (p.costPrice * p.quantity),
    }))

    // Total metrics
    const totalRevenue = aggregatedProducts.reduce((sum, p) => sum + p.totalSum, 0)
    const totalCost = aggregatedProducts.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0)
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
  async () => {
    const supabase = getCacheClient()
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const [
      { count: totalOrders },
      { count: totalProducts },
      { count: totalCustomers },
      { count: totalEmployees },
      { data: recentOrders },
      { data: chartTxData },
      { data: allTxAmounts },
      { data: lowStockRows },
      { count: pendingInvoices },
    ] = await Promise.all([
      supabase.from('sales_orders').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase
        .from('sales_orders')
        .select('id, order_number, status, total_amount, order_date, customers(name)')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('transactions')
        .select('amount, type, transaction_date')
        .gte('transaction_date', sixMonthsAgo)
        .order('transaction_date', { ascending: true }),
      supabase.from('transactions').select('amount, type, transaction_date'),
      supabase.from('products').select('id, name, sku, stock, min_stock').order('stock', { ascending: true }).limit(10),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).in('status', ['sent', 'overdue']),
    ])

    const incomeRows = (allTxAmounts ?? []).filter((tx: any) => tx.type === 'income')
    const expenseRows = (allTxAmounts ?? []).filter((tx: any) => tx.type === 'expense')

    return {
      totalOrders,
      totalProducts,
      totalCustomers,
      totalEmployees,
      recentOrders: recentOrders ?? [],
      chartTxData: chartTxData ?? [],
      incomeRows,
      expenseRows,
      lowStockRows: lowStockRows ?? [],
      pendingInvoices,
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
      CACHE_TAGS.transactions,
      CACHE_TAGS.invoices,
    ],
    revalidate: 60,
  }
)

// ─── Form select options (very stable data) ───────────────────────────────────

export const getCachedCategoriesForSelect = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('categories')
      .select('id, name')
      .order('name')
    return data ?? []
  },
  ['categories-select'],
  { tags: [CACHE_TAGS.categories], revalidate: 120 }
)

export const getCachedProductsForSelect = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('products')
      .select('id, name, price, cost_price, stock, unit, sku')
      .eq('is_active', true)
      .order('name')
    return data ?? []
  },
  ['products-select'],
  { tags: [CACHE_TAGS.products], revalidate: 60 }
)

export const getCachedDepartmentsForSelect = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name')
    return data ?? []
  },
  ['departments-select'],
  { tags: [CACHE_TAGS.departments], revalidate: 120 }
)

export const getCachedSuppliersForSelect = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name')
    return data ?? []
  },
  ['suppliers-select'],
  { tags: [CACHE_TAGS.suppliers], revalidate: 120 }
)

export const getCachedCustomersForSelect = unstable_cache(
  async () => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .order('name')
    return data ?? []
  },
  ['customers-select'],
  { tags: [CACHE_TAGS.customers], revalidate: 120 }
)

export const getCachedCustomerById = unstable_cache(
  async (id: string) => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()
    return data
  },
  ['customer-by-id'],
  { tags: [CACHE_TAGS.customers], revalidate: 60 }
)

export const getCachedOrderById = unstable_cache(
  async (id: string) => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('sales_orders')
      .select('*, customers(name)')
      .eq('id', id)
      .single()
    return data
  },
  ['order-by-id'],
  { tags: [CACHE_TAGS.orders, CACHE_TAGS.customers], revalidate: 30 }
)

export const getCachedInvoiceById = unstable_cache(
  async (id: string) => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(name), sales_orders(order_number)')
      .eq('id', id)
      .single()
    return data
  },
  ['invoice-by-id'],
  { tags: [CACHE_TAGS.invoices], revalidate: 30 }
)

export const getCachedTransactionById = unstable_cache(
  async (id: string) => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()
    return data
  },
  ['transaction-by-id'],
  { tags: [CACHE_TAGS.transactions], revalidate: 30 }
)

export const getCachedEmployeeById = unstable_cache(
  async (id: string) => {
    const supabase = getCacheClient()
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },
  ['employee-by-id'],
  { tags: ['employees'], revalidate: 3600 }
)

export const getCachedDepartmentById = unstable_cache(
  async (id: string) => {
    const supabase = getCacheClient()
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },
  ['department-by-id'],
  { tags: ['departments'], revalidate: 3600 }
)

export const getCachedSupplierById = unstable_cache(
  async (id: string) => {
    const supabase = getCacheClient()
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single()
    return data
  },
  ['supplier-by-id'],
  { tags: [CACHE_TAGS.suppliers], revalidate: 60 }
)

export const getCachedProductDetails = unstable_cache(
  async (id: string) => {
    const supabase = getCacheClient()
    const [
      { data: product },
      { data: movements },
      { data: salesOrderItems },
      { data: purchaseOrderItems },
    ] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('id', id).single(),
      supabase.from('stock_movements').select('*').eq('product_id', id).order('created_at', { ascending: false }),
      supabase.from('sales_order_items').select('quantity, total_price, sales_orders(order_number, order_date, status, customers(name))').eq('product_id', id),
      supabase.from('purchase_order_items').select('quantity, total_cost, purchase_orders(po_number, order_date, status, suppliers(name))').eq('product_id', id),
    ])
    return {
      product,
      movements: movements ?? [],
      sales: salesOrderItems ?? [],
      purchases: purchaseOrderItems ?? [],
    }
  },
  ['product-details-by-id'],
  { tags: [CACHE_TAGS.products, CACHE_TAGS.movements, CACHE_TAGS.orders, CACHE_TAGS.purchaseOrders], revalidate: 30 }
)

export const getCachedEmployeeDetails = unstable_cache(
  async (id: string) => {
    const supabase = getCacheClient()
    const { data: employee } = await supabase
      .from('employees')
      .select('*, profiles(*, departments!fk_profiles_department(name))')
      .eq('id', id)
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
        .eq('reference_type', 'employee')
        .eq('reference_id', id)
        .order('transaction_date', { ascending: false }),
      profileId
        ? supabase
            .from('sales_orders')
            .select('*, customers(name)')
            .eq('created_by', profileId)
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
  async (id: string) => {
    const supabase = getCacheClient()
    const [
      { data: supplier },
      { data: purchaseOrders },
      { data: transactions },
    ] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', id).single(),
      supabase.from('purchase_orders').select('*').eq('supplier_id', id).order('order_date', { ascending: false }),
      supabase.from('transactions').select('*').eq('reference_type', 'supplier').eq('reference_id', id).order('transaction_date', { ascending: false }),
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

