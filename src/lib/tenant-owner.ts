import 'server-only'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'

/**
 * Finding the account a tenant's owner actually signs in with.
 *
 * The login page turns the phone into `{digits}@tenant.local` and signs in
 * with that email, so the owner login is *the auth user with that email* —
 * not simply `tenants.owner_user_id`, which can be missing (older tenants) or
 * point at a user whose email no longer matches the tenant's phone (a phone
 * change whose auth update failed). Setting a password on any other account
 * "succeeds" and still leaves the owner unable to sign in.
 */
export async function resolveTenantOwner(
  supabase: any,
  tenant: { id: string; phone: string; owner_user_id: string | null }
): Promise<{ userId: string; loginEmail: string; emailMatches: boolean } | null> {
  const loginEmail = phoneToSyntheticEmail(tenant.phone)

  const candidates: string[] = []
  const add = (id: string | null | undefined) => {
    if (id && !candidates.includes(id)) candidates.push(id)
  }
  add(tenant.owner_user_id)

  const [{ data: byEmail }, { data: admins }] = await Promise.all([
    supabase.from('profiles').select('id').eq('tenant_id', tenant.id).eq('email', loginEmail),
    supabase
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('role', 'admin')
      .order('created_at', { ascending: true }),
  ])
  for (const row of byEmail ?? []) add(row.id)
  for (const row of admins ?? []) add(row.id)

  // Prefer whichever candidate the login page would actually reach.
  for (const id of candidates) {
    const { data } = await supabase.auth.admin.getUserById(id)
    if (data?.user?.email?.toLowerCase() === loginEmail) {
      return { userId: id, loginEmail, emailMatches: true }
    }
  }

  // None of them signs in with the tenant's phone: fall back to the recorded
  // owner (or the first admin), whose login email the caller then corrects.
  const fallback = candidates[0]
  return fallback ? { userId: fallback, loginEmail, emailMatches: false } : null
}
