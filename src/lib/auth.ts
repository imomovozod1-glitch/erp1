/**
 * Cached server-side auth + profile helpers.
 *
 * Why this file exists
 * ────────────────────
 * Every navigation hits DashboardLayout which needs to know:
 *   1. Who is the current user (for the redirect guard)
 *   2. Their profile row (for sidebar/header display)
 *
 * Naive approach makes TWO network calls per navigation:
 *   supabase.auth.getUser()  ← ~150 ms  (validates JWT with Supabase Auth)
 *   supabase.from('profiles') ← ~80 ms  (DB round-trip)
 *
 * This file reduces that to ≈ 0 ms for the auth part and < 1 ms for the
 * profile on repeat navigations.
 *
 * Security note
 * ─────────────
 * `getSession()` reads the JWT from the cookie WITHOUT a network call. It
 * is safe here because `middleware.ts` already calls `getUser()` (the
 * full server-side validation) on every request and redirects unauthenticated
 * users before they ever reach the layout. Using `getSession()` in the layout
 * is an intentional perf trade-off, not a security hole.
 */

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCacheClient } from '@/lib/supabase/cache-client'

/**
 * Returns the current session from the local JWT cookie.
 * No network call — reads the cookie directly.
 * Memoised with React `cache()` so multiple calls in one render tree
 * only create the client once.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
})

/**
 * Fully-validated current user — calls `getUser()`, which verifies the JWT with
 * the Auth server instead of merely decoding the cookie.
 *
 * Use this, NOT `getSessionUser()`, in every `/api/**` route handler. The
 * cookie-only shortcut above is safe under `[lang]/(dashboard)` because the
 * middleware validated the JWT first — but the middleware never runs for API
 * routes: `src/proxy.ts` excludes `/api` from its `config.matcher` and also
 * early-returns on `pathname.startsWith('/api/')`. Without that upstream check,
 * `getSession()` returns whatever the request's cookie claims, unverified —
 * auth-js documents its result as untrusted for cookie storage precisely
 * because of this. Routes acting with the service-role key (creating logins,
 * resetting passwords) must never be gated on an unverified identity.
 */
export const getVerifiedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
})

/**
 * Returns the profile row for a given user id.
 * Cached for 5 minutes in the Next.js Data Cache, keyed by user id.
 * Invalidated via revalidateTag('profile:<userId>') when the profile changes.
 */
const _getCachedProfile = (userId: string) =>
  unstable_cache(
    async () => {
      const supabase = getCacheClient()
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      return data
    },
    ['user-profile', userId],
    { revalidate: 300, tags: [`profile:${userId}`] }
  )()

export async function getCachedProfile(userId: string) {
  return _getCachedProfile(userId)
}

export interface TenantContext {
  userId: string
  tenantId: string
  role: string
}

/**
 * Resolves the caller's verified identity plus their tenant, for `/api/**`
 * route handlers. Returns `null` when there is no valid session or the
 * profile carries no tenant — callers turn that into a 401/403.
 *
 * Uses `getVerifiedUser()` (not `getSessionUser()`) because the middleware
 * never runs for API routes — see the note on `getVerifiedUser` above. The
 * tenant always comes from the DB-backed profile row, never from the request
 * body or the subdomain header, so one tenant can't act inside another.
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const user = await getVerifiedUser()
  if (!user) return null
  const profile = (await getCachedProfile(user.id)) as { role?: string; tenant_id?: string } | null
  if (!profile?.tenant_id) return null
  return { userId: user.id, tenantId: profile.tenant_id, role: profile.role ?? 'staff' }
}
