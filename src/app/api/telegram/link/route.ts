import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { checkLoginRateLimit, recordLoginAttempt, getClientIp } from '@/lib/rate-limit'
import { verifyTelegramInitData, telegramDisplayName } from '@/lib/telegram-miniapp'

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

  const email = phoneToSyntheticEmail(parsed.data.phone)
  const ip = getClientIp(request)
  const rateLimit = await checkLoginRateLimit(email, ip)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 })
  }

  // Signing in here also establishes the normal Supabase session cookies, so
  // the Mini App lands in the app already authenticated.
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  })
  await recordLoginAttempt(email, ip, !error)
  if (error || !auth.user) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

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
    const message = linkError.code === '23505' ? 'already_linked' : linkError.message
    return NextResponse.json({ error: message }, { status: 409 })
  }

  const { data: tenant } = await service
    .from('tenants')
    .select('subdomain, company_name')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  return NextResponse.json({
    linked: true,
    subdomain: tenant?.subdomain ?? null,
    companyName: tenant?.company_name ?? null,
  })
}
