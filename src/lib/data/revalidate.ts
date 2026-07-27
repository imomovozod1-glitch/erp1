/**
 * Cache invalidation helpers.
 *
 * Call these from Server Actions or API routes after any mutation
 * so the Next.js Data Cache is purged and the next request re-fetches
 * fresh data from Supabase.
 *
 * Example usage in a Server Action:
 *   import { invalidateProducts } from '@/lib/data/revalidate'
 *   await supabase.from('products').insert(...)
 *   invalidateProducts()
 */

'use server'

import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from './queries'

export async function invalidateProducts() {
  revalidateTag(CACHE_TAGS.products, undefined as any)
}

export async function invalidateCategories() {
  revalidateTag(CACHE_TAGS.categories, undefined as any)
}

export async function invalidateMovements() {
  revalidateTag(CACHE_TAGS.movements, undefined as any)
}

export async function invalidateOrders() {
  revalidateTag(CACHE_TAGS.orders, undefined as any)
  revalidateTag(CACHE_TAGS.dashboard, undefined as any)
}

export async function invalidateOrderItems() {
  revalidateTag(CACHE_TAGS.orderItems, undefined as any)
  revalidateTag(CACHE_TAGS.analytics, undefined as any)
}

export async function invalidateCustomers() {
  revalidateTag(CACHE_TAGS.customers, undefined as any)
}

export async function invalidateInvoices() {
  revalidateTag(CACHE_TAGS.invoices, undefined as any)
  revalidateTag(CACHE_TAGS.dashboard, undefined as any)
}

export async function invalidateEmployees() {
  revalidateTag(CACHE_TAGS.employees, undefined as any)
}

export async function invalidateDepartments() {
  revalidateTag(CACHE_TAGS.departments, undefined as any)
}

export async function invalidateSuppliers() {
  revalidateTag(CACHE_TAGS.suppliers, undefined as any)
}

export async function invalidatePurchaseOrders() {
  revalidateTag(CACHE_TAGS.purchaseOrders, undefined as any)
}

export async function invalidateTransactions() {
  revalidateTag(CACHE_TAGS.transactions, undefined as any)
  revalidateTag(CACHE_TAGS.dashboard, undefined as any)
}

export async function invalidateAnalytics() {
  revalidateTag(CACHE_TAGS.analytics, undefined as any)
  revalidateTag(CACHE_TAGS.orderItems, undefined as any)
}

export async function invalidateAll() {
  Object.values(CACHE_TAGS).forEach((tag) => revalidateTag(tag, undefined as any))
}
