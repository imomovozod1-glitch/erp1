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

/**
 * Messages the platform itself sends to a company, as opposed to the business
 * events above.
 *
 * Deliberately NOT in TELEGRAM_EVENTS: that list is rendered as a checkbox per
 * event and is opt-in — `telegram_events[event] !== true` means off — so a
 * subscription warning added there would be silently disabled for every
 * company that already exists, which is every company that could need it. It
 * is still gated by `telegram_enabled`: a company that has not connected a bot
 * at all gets nothing, and switching the integration off switches this off too.
 */
export const TELEGRAM_SYSTEM_EVENTS = ['subscription_expiring'] as const

export type TelegramSystemEvent = (typeof TELEGRAM_SYSTEM_EVENTS)[number]
