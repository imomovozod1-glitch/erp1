/**
 * The list of notifiable Telegram events, in a module with no server-only
 * dependencies so the settings UI can render a checkbox per event.
 *
 * Kept separate from `telegram.ts` on purpose: that module is `server-only`
 * (it reads the bot token), so importing the event list from there would make
 * the client component fail to build. Both the server module and the notify
 * route re-use these exact keys, and they must match the JSONB keys stored in
 * `integration_settings.telegram_events`.
 */
export const TELEGRAM_EVENTS = ['sale', 'low_stock', 'new_order', 'debt_payment'] as const

export type TelegramEvent = (typeof TELEGRAM_EVENTS)[number]
