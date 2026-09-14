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

export * from './cache-tags'
export * from './inventory'
export * from './sales'
export * from './customers'
export * from './finance'
export * from './hr'
export * from './procurement'
export * from './analytics'
// Re-exported for the callers that imported it from here before it moved out
// of the query layer; new code should import it from '@/lib/sales-discounts'.
export { orderDiscountFactors } from '@/lib/sales-discounts'
