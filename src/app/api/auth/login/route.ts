import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { checkLoginRateLimit, recordLoginAttempt, getClientIp } from '@/lib/rate-limit'

const loginSchema = z.object({
  phone: z.string().min(7),
  password: z.string().min(6),
})

/**
 * Tenant phone-login goes through this route (instead of the browser client
 * calling signInWithPassword directly) so failed attempts can be rate-limited
 * server-side before they ever reach Supabase Auth — see src/lib/rate-limit.ts.
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
