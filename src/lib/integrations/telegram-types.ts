/**
 * Shapes shared between the Telegram integration's server code and the
 * settings UI.
 *
 * Kept out of `telegram.ts` because that module is `server-only` — it reads
 * the bot token — and the settings card, a Client Component, needs this type.
 * A type-only import would be erased anyway, but a separate module makes the
 * boundary explicit rather than relying on that.
 */

/** The languages the company's bot can write in — the app's own locales. */
export const TELEGRAM_LANGUAGES = ['uz', 'ru', 'en'] as const
export type TelegramLanguage = (typeof TELEGRAM_LANGUAGES)[number]

export function normaliseTelegramLanguage(value: unknown): TelegramLanguage {
  return (TELEGRAM_LANGUAGES as readonly unknown[]).includes(value) ? (value as TelegramLanguage) : 'uz'
}

/** What the settings screen is allowed to know: never the token, only a mask. */
export interface TelegramStatus {
  connected: boolean
  /** Token stored, but no destination chat known yet. */
  awaitingChat: boolean
  enabled: boolean
  chatId: string
  botUsername: string | null
  tokenHint: string | null
  events: Record<string, boolean>
  linkedAt: string | null
  /** The language the bot writes its notifications in. */
  language: TelegramLanguage
}
