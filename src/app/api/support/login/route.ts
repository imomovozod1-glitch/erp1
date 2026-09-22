import { NextRequest, NextResponse, after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { checkLoginRateLimit, recordLoginAttempt, getClientIp, tooManyAttemptsBody } from '@/lib/rate-limit'

const loginSchema = z.object({
  phone: z.string().min(7),
  password: z.string().min(6),
})

/**
 * Support-agent phone-login — same shape as the tenant login route
 * (src/app/api/auth/login/route.ts), reusing the same synthetic-email
 * convention (src/lib/tenant-auth.ts). Membership of `support_agents` is
 * checked here as well as by getSupportAgentSession() (src/lib/admin-auth.ts)
 * on the pages themselves: authenticating only proves the password, and these
 * are the same auth cookies tenant users sign in with, so accepting the
 * sign-in and letting the portal bounce the session back to this same form
 * left the person with no idea why their correct password did nothing.
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

  // Uncached and service-role, for the same reason as the super-admin route:
  // a sign-in decision cannot ride on getStaffIdentity()'s five-minute cache.
  const { data: agent } = await (getCacheClient() as any)
    .from('support_agents')
    .select('id')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (!agent) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'not_agent' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
