/**
 * Current-tenant resolution for Server Components.
 *
 * Mirrors the pattern in `src/lib/auth.ts` (`getSessionUser`/`getCachedProfile`):
 * a `React.cache()`-memoized resolver so every `page.tsx` in `(dashboard)` can
 * independently call `getCurrentTenantId()` — Next.js doesn't let a layout pass
 * props to the page it wraps, so each page has to re-derive it, but the memo
 * means that costs nothing beyond the first call within a single request.
 *
 * `getCurrentTenantId()` is deliberately the *only* source of "which tenant" for
 * both the cached read layer (`queries.ts`) and, transitively via `profiles`,
 * RLS-protected writes — see the multi-tenant migration plan for why mixing a
 * second, subdomain-derived source of truth here would be a real risk.
 */

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'

export const getCurrentTenantId = cache(async (): Promise<string | null> => {
  const user = await getSessionUser()
  if (!user) return null
  const profile = await getCachedProfile(user.id)
  return (profile as any)?.tenant_id ?? null
})

const _getCachedTenant = (tenantId: string) =>
  unstable_cache(
    async () => {
      const supabase = getCacheClient() as any
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single()
      return data
    },
    ['tenant-by-id', tenantId],
    { revalidate: 60, tags: [`tenant:${tenantId}`] }
  )()

/** Full tenant row (status, costing_method, subscription info, etc). */
export async function getCachedTenant(tenantId: string) {
  return _getCachedTenant(tenantId)
}
