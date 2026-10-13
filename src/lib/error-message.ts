import { BusinessRpcError, businessRpcErrorMessage } from '@/lib/business-rpc'

/**
 * Any error, in the user's language.
 *
 * Supabase, PostgREST, `fetch` and our own API routes all fail with English
 * text, and showing `error.message` put that text in front of an Uzbek or
 * Russian user. This turns every shape we meet into a key of the top-level
 * `errors` namespace (messages/*.json) and falls back to the caller's own
 * translated message for anything it cannot name:
 *
 * - a `BusinessRpcError` → `businessRpcErrorMessage` (its own keys);
 * - an API body `{ error: '<code>' }`, a bare `'<code>'`, or an `Error` whose
 *   message is a code → `errors.<code>` when that key exists — so a route only
 *   has to answer a snake_case code and add the key, nothing here changes;
 * - a Postgres error code (unique / foreign key / RLS / bad value);
 * - a network failure (`TypeError: Failed to fetch`, offline).
 *
 * `t` is the ROOT translator (`useTranslations()` / `getTranslations()`).
 */
type RootTranslator = {
  (key: any, values?: any): string
  has: (key: any) => boolean
}

const POSTGRES_CODES: Record<string, string> = {
  '23505': 'duplicate',
  '23503': 'in_use',
  '23502': 'invalid_input',
  '23514': 'invalid_input',
  '22P02': 'invalid_input',
  '22001': 'value_too_long',
  '22003': 'invalid_input',
  '42501': 'forbidden',
  PGRST116: 'not_found',
  PGRST301: 'unauthorized',
  PGRST303: 'unauthorized',
}

const CODE_PATTERN = /^[a-z][a-z0-9_]*$/

export function errorCodeOf(error: unknown): string | null {
  if (!error) return null
  if (typeof error === 'string') return CODE_PATTERN.test(error) ? error : null
  if (typeof error !== 'object') return null

  const e = error as { code?: unknown; error?: unknown; message?: unknown; name?: unknown; status?: unknown }

  // Our API routes: { error: 'code' }.
  if (typeof e.error === 'string' && CODE_PATTERN.test(e.error)) return e.error

  // Postgres / PostgREST.
  if (typeof e.code === 'string' && POSTGRES_CODES[e.code]) return POSTGRES_CODES[e.code]

  // Supabase Auth names its refusals in `code` (weak_password, same_password, …).
  if (typeof e.code === 'string' && CODE_PATTERN.test(e.code)) return e.code

  if (e.status === 401) return 'unauthorized'
  if (e.status === 403) return 'forbidden'

  // A library wrapper that rethrew a Supabase error (`new Error(x.message, { cause: x })`).
  const cause = (error as { cause?: unknown }).cause
  if (cause && cause !== error) {
    const fromCause = errorCodeOf(cause)
    if (fromCause) return fromCause
  }

  if (typeof e.message === 'string') {
    if (CODE_PATTERN.test(e.message)) return e.message
    if (e.name === 'TypeError' && /fetch|network|load failed/i.test(e.message)) return 'network'
    if (/failed to fetch|networkerror|network request failed|load failed/i.test(e.message)) return 'network'
  }
  return null
}

export function errorMessage(t: RootTranslator, error: unknown, fallback: string): string {
  if (error instanceof BusinessRpcError) return businessRpcErrorMessage(t, error)
  const code = errorCodeOf(error)
  if (code && t.has(`errors.${code}`)) return t(`errors.${code}`)
  return fallback
}
