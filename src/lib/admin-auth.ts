/**
 * Super-admin session resolution — completely separate identity space from
 * tenant `profiles`/RLS. `super_admins` has no `authenticated`-role RLS
 * policy at all (see migration_multi_tenant.sql), so membership can only be
 * checked with the service-role client, never the browser/session client.
 * Used by both `/admin/(protected)/layout.tsx` (redirects on failure) and
 * the `/api/admin/**` route handlers (return 401/403 JSON on failure).
 */

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
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const serviceClient = getCacheClient() as any
  const { data } = await serviceClient.from('super_admins').select('id').eq('id', userId).maybeSingle()
  return !!data
}
