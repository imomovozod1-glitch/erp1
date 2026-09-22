import { NextRequest, NextResponse, after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { checkLoginRateLimit, recordLoginAttempt, getClientIp, tooManyAttemptsBody } from '@/lib/rate-limit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/**
 * Super-admin login goes through this route (instead of the browser client
 * calling signInWithPassword directly) so failed attempts can be
 * rate-limited server-side — this account has the widest blast radius in
 * the system (every tenant), so it's the highest-priority target to guard.
 *
 * Authenticating is not the same as belonging here: these are the same auth
 * cookies every tenant user and support agent signs in with, so a correct
 * password for some other kind of account used to be accepted at this form
 * and only turned back by getSuperAdminSession() on the next page — which
 * redirects to /admin/login, i.e. the same empty form again, saying nothing.
 * Membership of `super_admins` is checked right here instead.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase()
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

  // Read uncached, with the service role: getStaffIdentity() keeps its answer
  // for five minutes, and a sign-in must not be decided on a five-minute-old
  // view of who is staff — an account created a minute ago would be turned
  // away, and one deleted a minute ago would still be let in.
  const { data: admin } = await (getCacheClient() as any)
    .from('super_admins')
    .select('id')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (!admin) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'not_admin' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
