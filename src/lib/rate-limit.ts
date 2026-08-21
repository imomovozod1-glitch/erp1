import { getCacheClient } from '@/lib/supabase/cache-client'

const WINDOW_MINUTES = 15
const MAX_ATTEMPTS_PER_IDENTIFIER = 5
const MAX_ATTEMPTS_PER_IP = 20

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds?: number
}

/**
 * Brute-force guard for login routes. Two independent thresholds:
 * per-identifier (protects one account from a targeted password guess) and
 * per-IP (protects against one client spraying many different accounts).
 * Only failed attempts count — a legitimate user mistyping their password
 * a couple of times never gets blocked by their own successful login.
 */
export async function checkLoginRateLimit(identifier: string, ip: string): Promise<RateLimitResult> {
  const supabase = getCacheClient() as any
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

  const [identifierResult, ipResult] = await Promise.all([
    supabase
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('success', false)
      .gte('created_at', windowStart),
    supabase
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('success', false)
      .gte('created_at', windowStart),
  ])

  const identifierCount = identifierResult.count ?? 0
  const ipCount = ipResult.count ?? 0

  if (identifierCount >= MAX_ATTEMPTS_PER_IDENTIFIER || ipCount >= MAX_ATTEMPTS_PER_IP) {
    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 }
  }
  return { allowed: true }
}

export async function recordLoginAttempt(identifier: string, ip: string, success: boolean): Promise<void> {
  const supabase = getCacheClient() as any
  await supabase.from('login_attempts').insert({ identifier, ip, success })
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}
