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

export async function invalidateInvoices() {
  updateTag(CACHE_TAGS.invoices)
  updateTag(CACHE_TAGS.dashboard)
}

export async function invalidateEmployees() {
  updateTag(CACHE_TAGS.employees)
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

export async function invalidateAnalytics() {
  updateTag(CACHE_TAGS.analytics)
  updateTag(CACHE_TAGS.orderItems)
}

export async function invalidateProfile(userId: string) {
  updateTag(`profile:${userId}`)
}

export async function invalidateAll() {
  Object.values(CACHE_TAGS).forEach((tag) => updateTag(tag))
}

