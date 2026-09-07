/**
 * Super-admin session resolution — completely separate identity space from
 * tenant `profiles`/RLS. `super_admins` has no `authenticated`-role RLS
 * policy at all (see migration_multi_tenant.sql), so membership can only be
 * checked with the service-role client, never the browser/session client.
 * Used by both `/admin/(protected)/layout.tsx` (redirects on failure) and
 * the `/api/admin/**` route handlers (return 401/403 JSON on failure).
 */

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCacheClient } from '@/lib/supabase/cache-client'

export interface SuperAdminSession {
  userId: string
  fullName: string
  email: string
}

export async function getSuperAdminSession(): Promise<SuperAdminSession | null> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user) {
    console.warn('[getSuperAdminSession] no authenticated user on this request', userError?.message)
    return null
  }

  const serviceClient = getCacheClient() as any
  const { data: admin, error: adminError } = await serviceClient
    .from('super_admins')
    .select('id, full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!admin) {
    console.warn(
      `[getSuperAdminSession] user ${user.id} (${user.email}) is not in super_admins`,
      adminError?.message
    )
    return null
  }
  return { userId: admin.id, fullName: admin.full_name, email: admin.email }
}

/**
 * Super-admin and tenant sessions share the same Supabase Auth cookies (same
 * browser, same domain) — logging into /admin/login overwrites the session
 * cookie just like any other sign-in, so a super-admin who then opens the
 * tenant dashboard would otherwise render it using their own stray
 * `profiles` row (every `auth.users` row gets one via `handle_new_user()`,
 * super admins included). The tenant dashboard layout calls this to redirect
 * such sessions away instead of rendering as if they were a tenant user.
 */
export type StaffIdentity = 'super_admin' | 'support_agent' | null

/**
 * Which staff identity (if any) an auth user has.
 *
 * The dashboard layout has to answer this on every navigation, and it used to
 * do so with two separate, UNCACHED, strictly sequential Supabase round trips
 * (`isSuperAdmin` then `isSupportAgent`) before it could render anything —
 * on a connection where each round trip is 200-400ms, that alone put most of a
 * second in front of every page, for two lookups whose answer changes roughly
 * never.
 *
 * Now: both queries run concurrently, and the result is cached for 5 minutes
 * per user id and tagged so the admin routes that create or delete these
 * accounts can invalidate it immediately.
 */
const _getStaffIdentity = (userId: string) =>
  unstable_cache(
    async (): Promise<StaffIdentity> => {
      const serviceClient = getCacheClient() as any
      const [{ data: admin }, { data: agent }] = await Promise.all([
        serviceClient.from('super_admins').select('id').eq('id', userId).maybeSingle(),
        serviceClient.from('support_agents').select('id').eq('id', userId).maybeSingle(),
      ])
      if (admin) return 'super_admin'
      if (agent) return 'support_agent'
      return null
    },
    ['staff-identity', userId],
    { revalidate: 300, tags: [`staff-identity:${userId}`, 'staff-identity'] }
  )()

/** Memoised per request on top of the cross-request data cache. */
export const getStaffIdentity = cache(async (userId: string): Promise<StaffIdentity> =>
  _getStaffIdentity(userId)
)

export async function isSuperAdmin(userId: string): Promise<boolean> {
  return (await getStaffIdentity(userId)) === 'super_admin'
}

export interface SupportAgentSession {
  userId: string
  fullName: string
  phone: string
}

/**
 * Support-agent session resolution — same shape and same reasoning as
 * getSuperAdminSession() above: support_agents (migration_support_agents.sql)
 * has no `authenticated`-role RLS policy either, so membership can only be
 * checked with the service-role client.
 */
export async function getSupportAgentSession(): Promise<SupportAgentSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const serviceClient = getCacheClient() as any
  const { data: agent } = await serviceClient
    .from('support_agents')
    .select('id, full_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  if (!agent) return null
  return { userId: agent.id, fullName: agent.full_name, phone: agent.phone }
}

/**
 * Support agents also get a stray `profiles` row via handle_new_user() like
 * every other auth.users row — the tenant dashboard layout calls this to
 * redirect such sessions to their own /support portal instead of rendering
 * the tenant dashboard using that stray profile.
 */
export async function isSupportAgent(userId: string): Promise<boolean> {
  return (await getStaffIdentity(userId)) === 'support_agent'
}
