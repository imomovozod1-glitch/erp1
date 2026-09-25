/**
 * Reading the current company's feature flags in Server Components and API
 * routes. The registry and the pure helpers are in src/lib/features.ts — same
 * split as permissions.ts / permissions-server.ts, and for the same reason:
 * this half reaches for the tenant row and the Next data cache, which must not
 * end up in a client bundle.
 *
 * No query of its own: `getCachedTenant` already holds the whole row behind the
 * `tenant:<id>` cache tag (60 s TTL), and the admin console clears that tag when
 * a flag is flipped — so a toggle takes effect on the next navigation. It
 * selects `*`, which is also why this is safe to call on a database where
 * migration_tenant_features.sql has not been applied yet: the column is simply
 * absent and every flag reads as off.
 */

import { cache } from 'react'
import { getCurrentTenantId, getCachedTenant } from '@/lib/tenant'
import { isFeatureOn, normaliseFeatures, type FeatureFlag, type TenantFeatures } from '@/lib/features'

/** Memoised per request, on top of the cross-request data cache. */
export const getCurrentTenantFeatures = cache(async (): Promise<TenantFeatures> => {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return {}
  const tenant = await getCachedTenant(tenantId)
  return normaliseFeatures((tenant as { features?: unknown } | null)?.features)
})

/** `if (await hasFeature('x'))` — the server-side counterpart of `useFeature`. */
export async function hasFeature(flag: FeatureFlag): Promise<boolean> {
  return isFeatureOn(await getCurrentTenantFeatures(), flag)
}
