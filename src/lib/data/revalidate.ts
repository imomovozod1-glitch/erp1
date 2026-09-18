/**
 * Cache invalidation helpers.
 *
 * Call these from Server Actions after any mutation so the Next.js Data
 * Cache is purged and the next request re-fetches fresh data from Supabase.
 *
 * These use `updateTag` (Next.js 16+), not `revalidateTag`: `updateTag`
 * expires the tag immediately and makes the next request wait for fresh
 * data (read-your-own-writes), which is what a financial ERP needs after
 * a payment/transaction. `revalidateTag` without a profile is deprecated,
 * and with `profile: 'max'` it serves stale data until a later background
 * revalidation — exactly the "it saved but the balance didn't update"
 * symptom we don't want here. `updateTag` only works inside Server Actions
 * (which is what every function below is), not Route Handlers.
 *
 * Example usage in a Server Action:
 *   import { invalidateProducts } from '@/lib/data/revalidate'
 *   await supabase.from('products').insert(...)
 *   invalidateProducts()
 */

'use server'

import { updateTag } from 'next/cache'
import { CACHE_TAGS } from './queries'

export async function invalidateProducts() {
  updateTag(CACHE_TAGS.products)
}

export async function invalidateCategories() {
  updateTag(CACHE_TAGS.categories)
}

export async function invalidateMovements() {
  updateTag(CACHE_TAGS.movements)
}

export async function invalidateRoutes() {
  updateTag(CACHE_TAGS.routes)
}

export async function invalidateDeliveries() {
  updateTag(CACHE_TAGS.deliveries)
}

/**
 * A delivery status move — one action, see `invalidateSale`. It carries the
 * sales order with it (`set_delivery_status`), so the orders list and anything
 * counting open orders move at the same time.
 */
export async function invalidateDelivery() {
  for (const tag of [
    CACHE_TAGS.deliveries,
    CACHE_TAGS.orders,
    CACHE_TAGS.analytics,
    CACHE_TAGS.dashboard,
  ]) {
    updateTag(tag)
  }
}

export async function invalidateBoms() {
  updateTag(CACHE_TAGS.boms)
}

export async function invalidateProductionOrders() {
  updateTag(CACHE_TAGS.productionOrders)
}

export async function invalidateOrders() {
  updateTag(CACHE_TAGS.orders)
  updateTag(CACHE_TAGS.dashboard)
}

export async function invalidateOrderItems() {
  updateTag(CACHE_TAGS.orderItems)
  updateTag(CACHE_TAGS.analytics)
}

export async function invalidateCustomers() {
  updateTag(CACHE_TAGS.customers)
}

export async function invalidateCustomerCategories() {
  updateTag(CACHE_TAGS.customerCategories)
  updateTag(CACHE_TAGS.customers)
}

export async function invalidateInvoices() {
  updateTag(CACHE_TAGS.invoices)
  updateTag(CACHE_TAGS.dashboard)
}

export async function invalidateEmployees() {
  updateTag(CACHE_TAGS.employees)
}

export async function invalidateRoleTemplates() {
  updateTag(CACHE_TAGS.roleTemplates)
}

export async function invalidateDepartments() {
  updateTag(CACHE_TAGS.departments)
}

export async function invalidateSuppliers() {
  updateTag(CACHE_TAGS.suppliers)
}

export async function invalidatePurchaseOrders() {
  updateTag(CACHE_TAGS.purchaseOrders)
}

export async function invalidateTransactions() {
  updateTag(CACHE_TAGS.transactions)
  updateTag(CACHE_TAGS.dashboard)
}

export async function invalidateTransactionCategories() {
  updateTag(CACHE_TAGS.transactionCategories)
}

export async function invalidateAnalytics() {
  updateTag(CACHE_TAGS.analytics)
  updateTag(CACHE_TAGS.orderItems)
}

export async function invalidateProfile(userId: string) {
  updateTag(`profile:${userId}`)
}

export async function invalidateTenant(tenantId: string) {
  updateTag(CACHE_TAGS.tenants)
  updateTag(`tenant:${tenantId}`)
}

export async function invalidateAll() {
  Object.values(CACHE_TAGS).forEach((tag) => updateTag(tag))
}


export async function invalidateCashbox() {
  updateTag(CACHE_TAGS.cashbox)
  updateTag(CACHE_TAGS.transactions)
  updateTag(CACHE_TAGS.dashboard)
}

/**
 * Everything a sale touches — creating one (POS, sale form) or cancelling it:
 * stock, movements, orders and lines, invoices, transactions, customers,
 * cashboxes, analytics. One action instead of a `Promise.all` of the per-entity
 * ones: Next.js dispatches Server Actions one at a time, and each `updateTag`
 * call re-renders the current route, so nine separate calls meant nine
 * sequential round trips and nine page renders.
 */
export async function invalidateSale() {
  for (const tag of [
    CACHE_TAGS.products,
    CACHE_TAGS.movements,
    CACHE_TAGS.orders,
    CACHE_TAGS.orderItems,
    CACHE_TAGS.invoices,
    CACHE_TAGS.transactions,
    CACHE_TAGS.customers,
    CACHE_TAGS.cashbox,
    CACHE_TAGS.analytics,
    CACHE_TAGS.dashboard,
  ]) {
    updateTag(tag)
  }
}

/**
 * Everything completing or cancelling a production run touches — one action,
 * see `invalidateSale`. Components leave stock and the finished product enters
 * it, so the product list, movements and every stock figure on the dashboard
 * move together.
 */
export async function invalidateProduction() {
  for (const tag of [
    CACHE_TAGS.productionOrders,
    CACHE_TAGS.boms,
    CACHE_TAGS.products,
    CACHE_TAGS.movements,
    CACHE_TAGS.analytics,
    CACHE_TAGS.dashboard,
  ]) {
    updateTag(tag)
  }
}

/** Everything a received purchase touches — one action, see `invalidateSale`. */
export async function invalidatePurchase() {
  for (const tag of [
    CACHE_TAGS.purchaseOrders,
    CACHE_TAGS.products,
    CACHE_TAGS.movements,
    CACHE_TAGS.suppliers,
    CACHE_TAGS.dashboard,
  ]) {
    updateTag(tag)
  }
}

/**
 * Everything a cashbox movement can touch — the cashbox, its transaction, the
 * person it was for, and (for a customer receipt) the invoices it settled.
 * One action, see `invalidateSale`.
 */
export async function invalidateCashboxMovement() {
  for (const tag of [
    CACHE_TAGS.cashbox,
    CACHE_TAGS.transactions,
    CACHE_TAGS.suppliers,
    CACHE_TAGS.employees,
    CACHE_TAGS.customers,
    CACHE_TAGS.invoices,
    CACHE_TAGS.dashboard,
  ]) {
    updateTag(tag)
  }
}
