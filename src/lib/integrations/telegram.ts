import 'server-only'
import { getCacheClient } from '@/lib/supabase/cache-client'

/**
 * Telegram Bot API integration.
 *
 * `server-only`: this module reads `integration_settings.telegram_bot_token`,
 * a bearer secret that must never reach the browser bundle. The import above
 * makes an accidental client import a build error rather than a silent leak.
 * The table has no `authenticated` RLS policy at all (see
 * supabase/migration_integrations.sql), so the service-role client here is
 * the only way to reach it.
 */

const TELEGRAM_API = 'https://api.telegram.org'

// Re-exported from the client-safe module so server code has one import site
// while the settings UI can still reach the list without pulling in `server-only`.
export { TELEGRAM_EVENTS } from '@/lib/integrations/telegram-events'
export type { TelegramEvent } from '@/lib/integrations/telegram-events'

import type { TelegramEvent } from '@/lib/integrations/telegram-events'

export interface TelegramSettings {
  telegram_bot_token: string | null
  telegram_chat_id: string | null
  telegram_bot_username: string | null
  telegram_enabled: boolean
  telegram_events: Partial<Record<TelegramEvent, boolean>>
  telegram_linked_at: string | null
}

export interface TelegramBotInfo {
  id: number
  username: string
  first_name: string
}

/**
 * A Telegram bot token looks like `<numeric bot id>:<35-char secret>`.
 * Validated before we ever call the API so an obviously malformed paste
 * produces a clear message instead of a generic 404 from Telegram.
 */
export function isValidBotTokenFormat(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token.trim())
}

/**
 * Chat id: either a numeric id (negative for groups/supergroups) or an
 * `@channelusername`.
 */
export function isValidChatIdFormat(chatId: string): boolean {
  const v = chatId.trim()
  return /^-?\d+$/.test(v) || /^@[A-Za-z][A-Za-z0-9_]{4,}$/.test(v)
}

/** Masked hint for the UI — never returns the token itself. */
export function maskToken(token: string | null | undefined): string | null {
  if (!token) return null
  const [botId] = token.split(':')
  return `${botId}:${'•'.repeat(8)}`
}

type TelegramResult<T> = { ok: true; data: T } | { ok: false; error: string }

async function callTelegram<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramResult<T>> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
      // Telegram is a third party on the critical path of a user-facing
      // action — never let it hang a request handler indefinitely.
      signal: AbortSignal.timeout(10_000),
    })
    const json = await res.json().catch(() => null)
    if (!json?.ok) {
      return { ok: false, error: json?.description || `Telegram API error (${res.status})` }
    }
    return { ok: true, data: json.result as T }
  } catch (err) {
    const message = err instanceof Error && err.name === 'TimeoutError'
      ? 'Telegram did not respond in time'
      : 'Could not reach Telegram'
    return { ok: false, error: message }
  }
}

/** Verifies a token by asking Telegram who the bot is. */
export function getBotInfo(token: string) {
  return callTelegram<TelegramBotInfo>(token, 'getMe')
}

/** Sends a message. `text` is treated as HTML — pass it through `escapeHtml`. */
export function sendMessage(token: string, chatId: string, text: string) {
  return callTelegram<{ message_id: number }>(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  })
}

/**
 * Escapes the five characters Telegram's HTML parse mode treats as markup.
 * Every value interpolated into a message body must go through this —
 * a product or customer name containing `<` would otherwise make Telegram
 * reject the whole message with "can't parse entities".
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Reads a tenant's integration row. Returns null when nothing is configured yet. */
export async function getTelegramSettings(tenantId: string): Promise<TelegramSettings | null> {
  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('integration_settings')
    .select('telegram_bot_token, telegram_chat_id, telegram_bot_username, telegram_enabled, telegram_events, telegram_linked_at')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return (data as TelegramSettings) ?? null
}

/**
 * Sends a notification for `event` if this tenant has Telegram connected,
 * enabled, and that specific event turned on.
 *
 * Deliberately never throws: notifications are a side effect of business
 * actions (a completed sale, a received PO). A Telegram outage, a revoked
 * token, or the bot being kicked from the group must never surface as a
 * failed sale — the caller's own write has already succeeded by this point.
 * Failures are logged and swallowed; the return value says what happened for
 * callers that want to report it (the "send test message" route does).
 */
export async function notifyTelegram(
  tenantId: string,
  event: TelegramEvent,
  text: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const settings = await getTelegramSettings(tenantId)
    if (!settings?.telegram_enabled) return { sent: false, reason: 'disabled' }
    if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
      return { sent: false, reason: 'not_configured' }
    }
    if (settings.telegram_events?.[event] !== true) return { sent: false, reason: 'event_off' }

    const result = await sendMessage(settings.telegram_bot_token, settings.telegram_chat_id, text)
    if (!result.ok) {
      console.warn(`[telegram] ${event} notification failed for tenant ${tenantId}:`, result.error)
      return { sent: false, reason: result.error }
    }
    return { sent: true }
  } catch (err) {
    console.warn(`[telegram] ${event} notification threw for tenant ${tenantId}:`, err)
    return { sent: false, reason: 'unexpected_error' }
  }
}
