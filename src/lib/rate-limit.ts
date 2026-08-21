import { getCacheClient } from '@/lib/supabase/cache-client'

export const WINDOW_MINUTES = 15
export const MAX_ATTEMPTS_PER_IDENTIFIER = 5
export const MAX_ATTEMPTS_PER_IP = 20

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

/**
 * Counts identifiers currently over the failed-attempt threshold within the
 * rate-limit window — used by the admin security log's "currently locked"
 * stat. A plain helper (not a component/hook) so the `Date.now()` call
 * doesn't trip the React Compiler purity lint rule the way it would inside
 * a Server Component's render body.
 */
export function countCurrentlyLocked(
  attempts: { identifier: string; success: boolean; created_at: string }[]
): number {
  const windowStart = Date.now() - WINDOW_MINUTES * 60 * 1000
  const failedCountByIdentifier = new Map<string, number>()
  for (const a of attempts) {
    if (a.success || new Date(a.created_at).getTime() < windowStart) continue
    failedCountByIdentifier.set(a.identifier, (failedCountByIdentifier.get(a.identifier) ?? 0) + 1)
  }
  return [...failedCountByIdentifier.values()].filter((n) => n >= MAX_ATTEMPTS_PER_IDENTIFIER).length
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}
