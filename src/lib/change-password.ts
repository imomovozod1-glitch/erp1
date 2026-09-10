import type { SupabaseClient } from '@supabase/supabase-js'
import { recordSecurityEvent } from '@/lib/security-events'

/**
 * Change the signed-in user's own password, with the controls a self-service
 * password change needs.
 *
 * Re-authentication is the point. `updateUser({ password })` on its own only
 * requires a live session, so anyone who reached an unattended unlocked screen
 * could set a new password, keep the account, and lock the owner out with
 * nothing recorded. Proving knowledge of the current password closes that.
 *
 * Shared by the tenant and super-admin security forms so the two can't drift.
 */
export async function changeOwnPassword(
  supabase: SupabaseClient,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; reason: 'no-session' | 'wrong-current' | 'failed'; message?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user?.email) return { ok: false, reason: 'no-session' }

  // Verifying by signing in again: Supabase's own reauthenticate() delivers a
  // nonce over email/SMS, neither of which is configured here (tenant logins
  // use a synthetic address — see src/lib/tenant-auth.ts). Same user, so the
  // refreshed session this returns is the one we want anyway.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (reauthError) {
    await recordSecurityEvent(supabase, 'password_change_failed', user.id, user.email)
    return { ok: false, reason: 'wrong-current' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, reason: 'failed', message: error.message }

  await recordSecurityEvent(supabase, 'password_changed', user.id, user.email)

  // Whoever held a session on another device held it under the old password.
  // Best-effort: the password is already changed, and failing to reach the
  // sign-out endpoint must not report the change itself as failed.
  try {
    await supabase.auth.signOut({ scope: 'others' })
  } catch {
    /* ignored — see above */
  }

  return { ok: true }
}
