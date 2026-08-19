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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const serviceClient = getCacheClient() as any
  const { data: admin } = await serviceClient
    .from('super_admins')
    .select('id, full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!admin) return null
  return { userId: admin.id, fullName: admin.full_name, email: admin.email }
}
