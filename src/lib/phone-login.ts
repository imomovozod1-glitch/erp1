import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { memberLoginEmail, phoneDigits, phoneToSyntheticEmail } from '@/lib/tenant-auth'

/**
 * Phone sign-in across the two login shapes (src/lib/tenant-auth.ts):
 * the global `{digits}@tenant.local` (tenant owners, support agents, older
 * members) and the tenant-scoped `{digits}@{tenantId}.tenant.local` (members).
 *
 * The same phone can therefore belong to several accounts, each with its own
 * password, and the sign-in tries the ones that could be meant, in order:
 *
 * - on a company's own host (`tenantId` known): that company's member login,
 *   then the global one;
 * - on a host with no company (the apex, the Capacitor shell, the Telegram
 *   Mini App): the global login, then every member login with that phone.
 *
 * The first one whose password matches wins. Only accounts that EXIST are
 * tried, so a wrong password costs one or two Auth calls, not one per company.
 */

/** At most this many member logins are tried on a host with no company. */
const MAX_MEMBER_CANDIDATES = 5

async function existingLoginEmails(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set()
  const service = getCacheClient() as any
  const { data } = await service.from('profiles').select('email').in('email', emails)
  return new Set((data ?? []).map((row: { email: string }) => row.email))
}

async function memberEmailsForPhone(phone: string): Promise<string[]> {
  const service = getCacheClient() as any
  const { data } = await service
    .from('profiles')
    .select('email')
    .like('email', `${phoneDigits(phone)}@%.tenant.local`)
    .not('tenant_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(MAX_MEMBER_CANDIDATES)
  return (data ?? []).map((row: { email: string }) => row.email)
}

/** The candidate login emails for this phone, in the order they are tried. */
export async function loginCandidates(phone: string, tenantId: string | null): Promise<string[]> {
  const global = phoneToSyntheticEmail(phone)
  if (tenantId) {
    const scoped = memberLoginEmail(phone, tenantId)
    const existing = await existingLoginEmails([scoped])
    return existing.has(scoped) ? [scoped, global] : [global]
  }
  return [global, ...(await memberEmailsForPhone(phone))]
}

export async function signInWithPhone(
  supabase: SupabaseClient,
  phone: string,
  password: string,
  tenantId: string | null
): Promise<{ ok: true; user: User; email: string } | { ok: false }> {
  for (const email of await loginCandidates(phone, tenantId)) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user) return { ok: true, user: data.user, email }
  }
  return { ok: false }
}

/** The company served on `subdomain`, if any — for scoping a sign-in to it. */
export async function tenantIdForSubdomain(subdomain: string | null): Promise<string | null> {
  if (!subdomain) return null
  const service = getCacheClient() as any
  const { data } = await service
    .from('tenants')
    .select('id')
    .eq('subdomain', subdomain.toLowerCase())
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Is `phone` already some OTHER company's phone? Compared by digits, so
 * `+998 33 333 33 33` and `+998333333333` are the same number. Company phones
 * are unique among companies; a member's phone never counts here.
 */
export async function tenantPhoneTaken(phone: string, exceptTenantId: string | null): Promise<boolean> {
  const digits = phoneDigits(phone)
  const service = getCacheClient() as any
  const { data } = await service.from('tenants').select('id, phone')
  return (data ?? []).some(
    (row: { id: string; phone: string | null }) =>
      row.id !== exceptTenantId && row.phone && phoneDigits(row.phone) === digits
  )
}

/**
 * Makes the global login of `phone` available to `tenantId`'s owner.
 *
 * When a MEMBER of some company still holds it (a member created before logins
 * were tenant-scoped, whose phone equals this company's), that member is moved
 * to their own scoped login — same password, same session rules, and every
 * sign-in path tries the scoped login too, so nothing changes for them. Anyone
 * else holding it (a support agent, or another company's owner) is a real
 * conflict and is reported as `phone_taken`.
 *
 * `ownerUserId` is the account that is ABOUT to take the address (it may
 * already hold it — then there is nothing to do).
 */
export async function freeGlobalLogin(
  phone: string,
  tenantId: string,
  ownerUserId: string | null
): Promise<{ ok: true } | { ok: false; error: 'phone_taken' | 'server_error' }> {
  const global = phoneToSyntheticEmail(phone)
  const service = getCacheClient() as any

  const { data: holders } = await service
    .from('profiles')
    .select('id, tenant_id')
    .eq('email', global)
  const holder = (holders ?? []).find((row: { id: string }) => row.id !== ownerUserId)
  if (!holder) return { ok: true }

  // A company member only — never another company's recorded owner.
  if (!holder.tenant_id) return { ok: false, error: 'phone_taken' }
  const { data: ownsTenant } = await service
    .from('tenants')
    .select('id')
    .eq('owner_user_id', holder.id)
    .neq('id', tenantId)
    .limit(1)
  if (ownsTenant?.length) return { ok: false, error: 'phone_taken' }

  const scoped = memberLoginEmail(phone, holder.tenant_id)
  const { error } = await service.auth.admin.updateUserById(holder.id, { email: scoped, email_confirm: true })
  if (error) {
    console.error('[phone-login] moving a member to its scoped login failed:', error)
    return { ok: false, error: 'server_error' }
  }
  await service.from('profiles').update({ email: scoped }).eq('id', holder.id)
  return { ok: true }
}
