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
