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
 * Support-agent phone-login — same shape as the tenant login route
 * (src/app/api/auth/login/route.ts), reusing the same synthetic-email
 * convention (src/lib/tenant-auth.ts). Whether the resulting session
 * actually belongs to a support agent is checked afterward by
 * getSupportAgentSession() (src/lib/admin-auth.ts) against support_agents —
 * this route only authenticates, it doesn't authorize.
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
