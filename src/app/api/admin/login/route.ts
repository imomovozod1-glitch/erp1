import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkLoginRateLimit, recordLoginAttempt, getClientIp } from '@/lib/rate-limit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/**
 * Super-admin login goes through this route (instead of the browser client
 * calling signInWithPassword directly) so failed attempts can be
 * rate-limited server-side — this account has the widest blast radius in
 * the system (every tenant), so it's the highest-priority target to guard.
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
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  })

  await recordLoginAttempt(email, ip, !error)

  if (error) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
