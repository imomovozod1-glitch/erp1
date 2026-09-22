import { NextRequest, NextResponse, after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isReservedSubdomain, phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { getTenantSubdomain } from '@/lib/tenant-host'
import { getStaffIdentity } from '@/lib/admin-auth'
import { computeEffectiveStatus } from '@/lib/tenant-status'
import { createTenantHandoff, requestOrigin } from '@/lib/tenant-handoff'
import { routing } from '@/i18n/routing'
import { checkLoginRateLimit, recordLoginAttempt, getClientIp, tooManyAttemptsBody } from '@/lib/rate-limit'

const loginSchema = z.object({
  phone: z.string().min(7),
  password: z.string().min(6),
})

/**
 * Tenant phone-login goes through this route (instead of the browser client
 * calling signInWithPassword directly) so failed attempts can be rate-limited
 * server-side before they ever reach Supabase Auth — see src/lib/rate-limit.ts.
 *
 * It is also where an account meets the subdomain it is signing in on. Every
 * tenant has its own host now (`<tenant>.<domain>`), and the credentials are
 * global — the same phone and password authenticate anywhere. Without the
 * check below, signing in on the wrong company's address succeeded here and
 * only fell over one navigation later, in (dashboard)/layout.tsx, which
 * bounces the session to /tenant-status?reason=wrong-tenant: a redirect to a
 * page about a company the person does not work for, with the login form gone
 * and no hint of what went wrong. The mismatch is answered here instead, on
 * the form they are looking at, and the half-session is signed out rather
 * than left behind.
 *
 * Staff get the same treatment: super-admins and support agents share these
 * auth cookies but have no `profiles` row, so their sign-in is refused with a
 * pointer to their own portal (src/components/auth/auth-portal-links.tsx).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const email = phoneToSyntheticEmail(parsed.data.phone)
  const ip = getClientIp(request)

  const rateLimit = await checkLoginRateLimit(email, ip)
  if (!rateLimit.allowed) {
    const { body, init } = tooManyAttemptsBody(rateLimit)
    return NextResponse.json(body, init)
  }

  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  })

  // Logged after the response is sent: the audit row is not something the
  // person signing in should wait for.
  after(() => recordLoginAttempt(email, ip, !error))

  if (error) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  // Cast: `tenant_id` is added to profiles by migration_multi_tenant.sql and
  // is not in the generated types, the same reason getCurrentTenantId()
  // (src/lib/tenant.ts) reaches for one.
  const { data: profile } = (await supabase
    .from('profiles')
    .select('is_active, tenant_id')
    .eq('id', auth.user.id)
    .maybeSingle()) as { data: { is_active: boolean | null; tenant_id: string | null } | null }
  if (profile?.is_active === false) {
    await supabase.auth.signOut({ scope: 'local' })
    return NextResponse.json({ error: 'account_disabled' }, { status: 403 })
  }

  // Which company's address this sign-in arrived on. The reserved hosts are
  // skipped because they are not companies at all — src/proxy.ts rewrites them
  // to the two consoles.
  const subdomain = getTenantSubdomain(request.headers.get('host') || '')
  const onTenantHost = Boolean(subdomain && !isReservedSubdomain(subdomain))

  if (onTenantHost) {
    // Staff first, and regardless of what profile row they carry:
    // handle_new_user() gives every auth user a `profiles` row, super-admins
    // and support agents included, so "has a profile" says nothing about who
    // this is. A staff session can never render a company workspace anyway —
    // (dashboard)/layout.tsx redirects it to its own console — so it is turned
    // back here, at the form, pointed at the portal that will actually take it.
    const staff = await getStaffIdentity(auth.user.id)
    if (staff) {
      await supabase.auth.signOut({ scope: 'local' })
      // Named by address, the same way the wrong-company case is: each console
      // has its own host (src/proxy.ts rewrites admin.<domain> and
      // support.<domain>), and that is where this account signs in.
      const portal = staff === 'super_admin' ? 'admin' : 'support'
      const host = request.headers.get('host') || ''
      return NextResponse.json(
        { error: 'staff_account', portal, host: host.replace(/^[^.]+/, portal) },
        { status: 403 }
      )
    }

    // A tenant user with no tenant: the profile row is there but unassigned,
    // so there is no company for this sign-in to belong to.
    if (!profile?.tenant_id) {
      await supabase.auth.signOut({ scope: 'local' })
      return NextResponse.json({ error: 'wrong_tenant' }, { status: 403 })
    }

    // Read through the user's own client, not the service role:
    // `tenant_read_own` (migration_multi_tenant.sql) already limits this to
    // the caller's tenant.
    const { data: ownTenant } = await supabase
      .from('tenants')
      .select('subdomain, status, subscription_ends_at')
      .eq('id', profile.tenant_id)
      .maybeSingle()
    const own = ownTenant as { subdomain?: string; status?: string; subscription_ends_at?: string | null } | null

    // Only a POSITIVE mismatch refuses. If the tenant row cannot be read at all
    // — the RLS policy missing on some deployment, a Supabase blip — the answer
    // is unknown, not "wrong", and failing closed here would turn that into
    // every tenant login on the platform being rejected. The hard check stays
    // where it always was, in (dashboard)/layout.tsx, which resolves the tenant
    // with the service role and cannot be blocked this way; this route only
    // decides whether the person is told about it on the form or one page later.
    const ownSubdomain = String(own?.subdomain || '').toLowerCase()
    if (ownSubdomain && ownSubdomain !== subdomain!.toLowerCase()) {
      await supabase.auth.signOut({ scope: 'local' })
      // The address that would have worked. Built by swapping the first label of
      // the host actually used, so it stays correct on `tenant.localhost:3000`
      // and on a preview domain instead of hard-coding the production apex.
      // Naming it leaks nothing: the password just proved this is their account.
      const host = request.headers.get('host') || ''
      return NextResponse.json(
        { error: 'wrong_tenant', host: host.replace(/^[^.]+/, ownSubdomain) },
        { status: 403 }
      )
    }

    // The subscription gate, on the way in. src/proxy.ts already refuses every
    // page on a lapsed company, but it does so by bouncing to /tenant-status
    // one navigation later; saying it here means the person is told before
    // they are handed a session they cannot use.
    if (own?.status && computeEffectiveStatus(own.status, own.subscription_ends_at ?? null) !== 'active') {
      await supabase.auth.signOut({ scope: 'local' })
      return NextResponse.json({ error: 'tenant_blocked' }, { status: 403 })
    }

    return NextResponse.json({ ok: true })
  }

  // ── Signed in on a host that serves no company ────────────────────────────
  // The apex, and the bare host the Capacitor shell and the Telegram Mini App
  // open. The workspace is never rendered here, so the session does not stay
  // here either: it is handed over to the company's own address
  // (src/lib/tenant-handoff.ts) and dropped on this one.
  //
  // Staff and unassigned accounts are left alone — they have no company host
  // to go to, and (dashboard)/layout.tsx sends them to their own console.
  if (!profile?.tenant_id) {
    return NextResponse.json({ ok: true })
  }

  const { host, protocol } = requestOrigin(request.headers)
  const handoff = await createTenantHandoff({
    userId: auth.user.id,
    email,
    requestHost: host,
    protocol,
    next: `/${routing.defaultLocale}/dashboard`,
  })

  if (!handoff.ok) {
    if (handoff.reason === 'tenant_blocked') {
      await supabase.auth.signOut({ scope: 'local' })
      return NextResponse.json({ error: 'tenant_blocked' }, { status: 403 })
    }
    // 'unavailable' (a preview deployment, or the token could not be minted)
    // and 'no_tenant': keep the session here rather than strand the sign-in.
    return NextResponse.json({ ok: true })
  }

  await supabase.auth.signOut({ scope: 'local' })
  return NextResponse.json({ ok: true, handoff: { host: handoff.target.host, url: handoff.target.url } })
}
