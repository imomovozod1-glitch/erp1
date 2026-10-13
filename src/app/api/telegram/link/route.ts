import { NextRequest, NextResponse, after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { signInWithPhone } from '@/lib/phone-login'
import { checkLoginRateLimit, recordLoginAttempt, getClientIp, tooManyAttemptsBody } from '@/lib/rate-limit'
import { verifyTelegramInitData, telegramDisplayName } from '@/lib/telegram-miniapp'
import { createTenantHandoff, requestOrigin } from '@/lib/tenant-handoff'
import { routing } from '@/i18n/routing'

const schema = z.object({
  initData: z.string().min(1).max(4096),
  phone: z.string().min(7),
  password: z.string().min(6),
})

/**
 * Binds a Telegram account to an ERP login, once.
 *
 * Requires BOTH a valid Telegram signature and the user's real credentials —
 * proving the Telegram identity alone would let anyone claim any account, and
 * proving the password alone would let a stolen initData bind someone else's
 * Telegram. Rate-limited like every other login path.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const verified = verifyTelegramInitData(parsed.data.initData)
  if (!verified.ok) {
    const status = verified.reason === 'no_bot_token' ? 500 : 401
    return NextResponse.json({ error: verified.reason }, { status })
  }

  // The rate-limit bucket is the phone's global login, whichever of its logins
  // (src/lib/phone-login.ts) the password opens.
  const rateKey = phoneToSyntheticEmail(parsed.data.phone)
  const ip = getClientIp(request)
  const rateLimit = await checkLoginRateLimit(rateKey, ip)
  if (!rateLimit.allowed) {
    const { body, init } = tooManyAttemptsBody(rateLimit)
    return NextResponse.json(body, init)
  }

  // Signing in here proves the password. The session it establishes belongs to
  // THIS host, though — Telegram opens the Mini App on the bare app host — and
  // the workspace lives on the company's own host, where these cookies are not
  // sent. So the session is handed over below rather than navigated away from:
  // jumping straight to the company host used to land the user on its login
  // form, one screen after they had just typed their password.
  const supabase = await createClient()
  // The Mini App opens on the bare host, so no company is known: every login
  // this phone has is tried.
  const signedIn = await signInWithPhone(supabase, parsed.data.phone, parsed.data.password, null)
  // Logged after the response is sent: the audit row is not something the
  // person signing in should wait for.
  after(() => recordLoginAttempt(rateKey, ip, signedIn.ok))
  if (!signedIn.ok) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }
  const auth = { user: signedIn.user }
  const email = signedIn.email

  const service = getCacheClient() as any
  const { data: profile } = await service
    .from('profiles')
    .select('id, tenant_id')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'no_tenant' }, { status: 403 })
  }

  const { error: linkError } = await service.from('telegram_links').upsert(
    {
      telegram_user_id: verified.data.user.id,
      profile_id: profile.id,
      tenant_id: profile.tenant_id,
      telegram_username: verified.data.user.username ?? null,
      telegram_name: telegramDisplayName(verified.data.user),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_user_id' }
  )

  if (linkError) {
    // The UNIQUE(profile_id) constraint: this ERP account is already bound to a
    // different Telegram account. Say so rather than leaking a raw SQL error.
    if (linkError.code === '23505') {
      return NextResponse.json({ error: 'already_linked' }, { status: 409 })
    }
    console.error('[telegram] link upsert failed:', linkError.message)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  const { data: tenant } = await service
    .from('tenants')
    .select('subdomain, company_name')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  const { host, protocol } = requestOrigin(request.headers)
  const handoff = await createTenantHandoff({
    userId: auth.user.id,
    email,
    requestHost: host,
    protocol,
    next: `/${routing.defaultLocale}/dashboard`,
  })

  if (!handoff.ok && handoff.reason === 'tenant_blocked') {
    await supabase.auth.signOut({ scope: 'local' })
    return NextResponse.json({ error: 'tenant_blocked' }, { status: 403 })
  }

  if (handoff.ok) {
    // Local scope only: this drops the cookies on the bare host, where they
    // are of no use to anyone, and leaves the user's other sessions alone.
    await supabase.auth.signOut({ scope: 'local' })
  }

  return NextResponse.json({
    linked: true,
    subdomain: tenant?.subdomain ?? null,
    companyName: tenant?.company_name ?? null,
    // Absent when this deployment has no company hosts (a preview build): the
    // Mini App then falls back to navigating by subdomain, as it always did.
    url: handoff.ok ? handoff.target.url : null,
  })
}
