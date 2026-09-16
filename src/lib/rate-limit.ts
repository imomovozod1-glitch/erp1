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

  // The newest failures only: the lock lifts when the MAX-th most recent one
  // leaves the window, because from then on fewer than MAX remain inside it.
  const [identifierResult, ipResult] = await Promise.all([
    supabase
      .from('login_attempts')
      .select('created_at')
      .eq('identifier', identifier)
      .eq('success', false)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(MAX_ATTEMPTS_PER_IDENTIFIER),
    supabase
      .from('login_attempts')
      .select('created_at')
      .eq('ip', ip)
      .eq('success', false)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(MAX_ATTEMPTS_PER_IP),
  ])

  const unlockAt = (rows: { created_at: string }[] | null, max: number): number => {
    if (!rows || rows.length < max) return 0
    return new Date(rows[max - 1].created_at).getTime() + WINDOW_MINUTES * 60 * 1000
  }
  const lockedUntil = Math.max(
    unlockAt(identifierResult.data, MAX_ATTEMPTS_PER_IDENTIFIER),
    unlockAt(ipResult.data, MAX_ATTEMPTS_PER_IP)
  )

  if (lockedUntil > Date.now()) {
    return { allowed: false, retryAfterSeconds: Math.ceil((lockedUntil - Date.now()) / 1000) }
  }
  return { allowed: true }
}

/**
 * The 429 every login route answers a lock with: `retryAfterSeconds` in the
 * body for the form's message, and the standard `Retry-After` header.
 */
export function tooManyAttemptsBody(result: RateLimitResult) {
  const retryAfterSeconds = result.retryAfterSeconds ?? WINDOW_MINUTES * 60
  return {
    body: { error: 'too_many_attempts', retryAfterSeconds },
    init: { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  }
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
