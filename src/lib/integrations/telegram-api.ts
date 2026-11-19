import 'server-only'

/** The Telegram Bot API calls themselves: token checks, bot info, chat discovery, sending. */

const TELEGRAM_API = 'https://api.telegram.org'

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

export type TelegramResult<T> = { ok: true; data: T } | { ok: false; error: string }

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

interface TelegramChat {
  id: number
  type: string
  title?: string
  username?: string
  first_name?: string
}

interface TelegramUpdate {
  update_id: number
  message?: { chat: TelegramChat }
  channel_post?: { chat: TelegramChat }
  my_chat_member?: { chat: TelegramChat }
}

export interface DiscoveredChat {
  chatId: string
  title: string
  type: string
}

function describeChat(chat: TelegramChat): DiscoveredChat {
  const title =
    chat.title ||
    [chat.first_name, chat.username ? `@${chat.username}` : null].filter(Boolean).join(' ') ||
    String(chat.id)
  return { chatId: String(chat.id), title, type: chat.type }
}

/**
 * Finds the chat a freshly connected bot should post to, so the admin only
 * ever has to paste the BotFather token.
 *
 * Telegram gives a bot no way to ask "who is my owner": the conversation has to
 * start from the human side. So the admin presses Start in the bot's private
 * chat (or adds it to a group) and the resulting update tells us the chat id.
 * We read the pending update queue WITHOUT confirming an offset, so the updates
 * stay available — nothing here consumes them out from under a future call.
 *
 * The newest update wins, and a group/channel is preferred over a private chat
 * when both are present: adding the bot to the company group is the deliberate
 * act, pressing Start is often just how the admin verified the token works.
 */
export async function discoverChat(token: string): Promise<TelegramResult<DiscoveredChat | null>> {
  const result = await callTelegram<TelegramUpdate[]>(token, 'getUpdates', {
    limit: 100,
    timeout: 0,
    allowed_updates: ['message', 'channel_post', 'my_chat_member'],
  })
  if (!result.ok) return result

  const chats = result.data
    .slice()
    .sort((a, b) => b.update_id - a.update_id)
    .map((update) => update.message?.chat ?? update.channel_post?.chat ?? update.my_chat_member?.chat)
    .filter((chat): chat is TelegramChat => !!chat)

  const group = chats.find((chat) => chat.type !== 'private')
  const chosen = group ?? chats[0]
  return { ok: true, data: chosen ? describeChat(chosen) : null }
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
