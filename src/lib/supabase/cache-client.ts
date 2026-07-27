/**
 * Supabase client for use INSIDE `unstable_cache()` functions.
 *
 * Why a separate client?
 * ─────────────────────
 * Next.js `unstable_cache` prohibits accessing dynamic data sources
 * (cookies, headers, etc.) inside the cache callback. The standard
 * `createClient()` from `server.ts` calls `cookies()` internally,
 * so it cannot be used inside a cache boundary.
 *
 * This client uses the anon key directly (no SSR cookie wrapper).
 * Routes are already protected at the middleware layer (`proxy.ts`),
 * so only authenticated users ever reach pages that use cached data.
 *
 * If your Supabase tables have RLS policies that require a user JWT,
 * set SUPABASE_SERVICE_ROLE_KEY in .env.local and use `createCacheClient`
 * which will automatically prefer the service role key.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

let _cacheClient: ReturnType<typeof createClient<Database>> | null = null

/**
 * Returns a singleton Supabase client that does NOT read cookies.
 * Safe for use inside `unstable_cache()` callbacks.
 */
export function getCacheClient() {
  if (_cacheClient) return _cacheClient

  // Prefer the service role key (bypasses RLS) if available,
  // otherwise fall back to the anon key (respects RLS but no user context).
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  _cacheClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: {
        // Disable session persistence — this is a server singleton,
        // not a user-facing client.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )

  return _cacheClient
}
