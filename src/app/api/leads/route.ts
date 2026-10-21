import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { getClientIp } from '@/lib/rate-limit'
import { phoneSchema } from '@/lib/phone-validation'
import { routing } from '@/i18n/routing'

/**
 * Sign-up request from the public landing page — no session, so it is guarded
 * by three cheap things instead: a honeypot field real visitors never fill, a
 * per-IP cap, and a quiet de-duplication of the same phone.
 *
 * Written with the service role into `leads` (supabase/migration_leads.sql),
 * which has no RLS policy for the browser; the super-admin console reads it.
 */

const MAX_PER_IP_PER_HOUR = 5
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

const leadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  company: z.string().trim().min(2).max(120),
  phone: phoneSchema('invalid_input'),
  comment: z.string().trim().max(500).optional(),
  lang: z.enum(routing.locales).optional(),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  // Honeypot: answered like a success so a bot has nothing to adapt to.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const parsed = leadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const { name, company, phone, comment, lang } = parsed.data
  const ip = getClientIp(request)

  const supabase = getCacheClient() as any
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', hourAgo)
  if (countError) {
    console.error('[leads]', countError)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
  if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return NextResponse.json({ error: 'too_many_attempts', retryAfterSeconds: 3600 }, { status: 429, headers: { 'Retry-After': '3600' } })
  }

  // The same number twice in a row is a double click, not a second customer.
  const { data: recent } = await supabase
    .from('leads')
    .select('id')
    .eq('phone', phone)
    .gte('created_at', new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString())
    .limit(1)
  if (recent?.length) return NextResponse.json({ ok: true })

  const { error } = await supabase.from('leads').insert({ name, company, phone, comment: comment || null, lang: lang ?? null, ip })
  if (error) {
    console.error('[leads]', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
