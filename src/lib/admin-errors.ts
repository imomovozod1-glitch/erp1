/**
 * Error codes the super-admin API (`src/app/api/admin/**`) answers with.
 *
 * A route answers `{ error: '<code>' }` — never a sentence — and the console
 * turns the code into the operator's language with `adminErrorMessage`
 * (`admin.errors.<code>` in messages/*.json). English text sent from the
 * server used to reach the toast as-is, whatever language the console was in.
 * Anything unexpected (a raw Supabase/Vercel message) answers `server_error`
 * and is logged on the server instead of shown.
 *
 * Adding a code: add it here AND under `admin.errors` in all three message
 * files. A code missing from this list falls back to the caller's generic
 * message rather than printing the key.
 */
export const ADMIN_ERROR_CODES = [
  'unauthorized',
  'invalid_input',
  'weak_password',
  'invalid_phone',
  'subdomain_reserved',
  'tenant_not_found',
  'agent_not_found',
  'admin_not_found',
  'phone_taken',
  'email_taken',
  'subdomain_or_phone_taken',
  'service_key_missing',
  'domains_unreadable',
  'domain_register_failed',
  'tenant_recently_active',
  'tenant_has_data',
  'cannot_remove_self',
  'cannot_remove_last_admin',
  'same_password',
  'server_error',
] as const

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number]

export function isAdminErrorCode(value: unknown): value is AdminErrorCode {
  return typeof value === 'string' && (ADMIN_ERROR_CODES as readonly string[]).includes(value)
}

/** Supabase Auth's "this email/phone already has a login" refusal, in any of its spellings. */
export function isDuplicateLoginError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === 'email_exists' || /already.*registered|already exists|email_exists/i.test(error.message ?? '')
}

/**
 * The translated message for an API error body (or a bare code). `t` is the
 * `admin.errors` translator; `fallback` is the caller's own already-translated
 * generic message, used for anything that is not a known code.
 */
export function adminErrorMessage(
  t: (key: AdminErrorCode) => string,
  body: unknown,
  fallback: string
): string {
  const code = typeof body === 'string' ? body : (body as { error?: unknown } | null)?.error
  return isAdminErrorCode(code) && code !== 'server_error' ? t(code) : fallback
}

/**
 * Supabase Auth errors raised in the browser (changing or recovering the
 * operator's own password) — the few with a meaning the operator can act on.
 */
export function authErrorCode(error: { code?: string; message?: string } | null | undefined): AdminErrorCode | null {
  if (!error) return null
  if (error.code === 'same_password' || /different from the old password/i.test(error.message ?? '')) return 'same_password'
  if (error.code === 'weak_password') return 'weak_password'
  return null
}

/** A failed zod parse as a code: a schema's own message when it is one (`weak_password`, …), else `invalid_input`. */
export function zodErrorCode(error: { issues: { message: string }[] }): AdminErrorCode {
  const message = error.issues[0]?.message
  return isAdminErrorCode(message) ? message : 'invalid_input'
}
