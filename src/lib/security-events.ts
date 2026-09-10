import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Append-only record of security-relevant account actions.
 *
 * Best-effort by design: a sign-in still succeeds and a password change still
 * takes effect if the write fails. Never let bookkeeping undo an action the
 * user has already completed.
 *
 * Requires supabase/migration_security_events.sql to have been applied. Until
 * it is, every call here is a silent no-op rather than an error the user sees.
 */
export type SecurityEvent = 'password_changed' | 'password_change_failed'

export async function recordSecurityEvent(
  supabase: SupabaseClient,
  event: SecurityEvent,
  userId: string,
  identifier: string
): Promise<void> {
  try {
    await (supabase as any).from('security_events').insert({
      user_id: userId,
      identifier,
      event,
      // Recorded from the browser, so the IP is not available here; the column
      // exists for server-side writers.
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
    })
  } catch {
    /* table missing or RLS refused — see the note above */
  }
}
