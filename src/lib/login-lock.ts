/**
 * Reading a login lock on the client. The login routes answer a lock with
 * `429 { error: 'too_many_attempts', retryAfterSeconds }` (src/lib/rate-limit.ts,
 * which is server-only — hence this separate file).
 */

/** Whole minutes left on a lock, never less than one. */
export function retryAfterMinutes(retryAfterSeconds: unknown): number {
  const seconds = Number(retryAfterSeconds)
  if (!Number.isFinite(seconds) || seconds <= 0) return 15
  return Math.max(1, Math.ceil(seconds / 60))
}

/** Minutes left, read from a 429 login response; `null` for any other response. */
export async function lockMinutesFrom(res: Response): Promise<number | null> {
  if (res.status !== 429) return null
  const json = await res.clone().json().catch(() => ({}))
  return retryAfterMinutes(json?.retryAfterSeconds ?? res.headers.get('Retry-After'))
}
