/**
 * Cache-tag names shared by the query layer and `revalidate.ts`.
 *
 * Their own module so a mutation can import the tag it needs to invalidate
 * without pulling in every query in the application.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 */

export const CACHE_TAGS = {
  products: 'products',
  categories: 'categories',
  movements: 'stock_movements',
  boms: 'product_boms',
  routes: 'distribution_routes',
  deliveries: 'deliveries',
  productionOrders: 'production_orders',
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
  roleTemplates: 'role_templates',
} as const
