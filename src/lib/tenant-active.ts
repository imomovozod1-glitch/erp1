/**
 * "May this company still use the system?", for the paths the middleware never
 * sees.
 *
 * src/proxy.ts refuses every PAGE of a lapsed company, but it does not run for
 * /api/**, and the API routes are a complete second door into the same data: a
 * session from a blocked company could still run reports, read roles, or post
 * to its own Telegram integration long after its subscription ended. The gate
 * belongs on both doors.
 *
 * Deliberately NOT in src/lib/tenant-status.ts: that module is imported by the
 * Edge middleware, and this one reaches for the service-role client and the
 * Next data cache, neither of which belongs in that bundle.
 */

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { computeEffectiveStatus } from '@/lib/tenant-status'

const readTenantActive = (tenantId: string) =>
  unstable_cache(
    async () => {
      const supabase = getCacheClient() as any
      const { data } = await supabase
        .from('tenants')
        .select('status, subscription_ends_at')
        .eq('id', tenantId)
        .maybeSingle()

      // Unknown is not "blocked": a Supabase blip or a missing service-role key
      // must not lock a paying company out of its own API. The page gate in
      // src/proxy.ts is the one that fails closed.
      if (!data) return true

      return computeEffectiveStatus(data.status, data.subscription_ends_at) === 'active'
    },
    ['tenant-active', tenantId],
    // Same tag the tenant row is cached under elsewhere, so recording a payment
    // can clear it immediately; the short TTL means it converges by itself even
    // when nothing clears it.
    { revalidate: 60, tags: [`tenant:${tenantId}`] }
  )()

/** Memoised per request on top of the cross-request data cache. */
export const isTenantActive = cache(async (tenantId: string): Promise<boolean> =>
  readTenantActive(tenantId)
)
