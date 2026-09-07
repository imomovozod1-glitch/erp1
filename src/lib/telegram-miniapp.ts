import 'server-only'
import crypto from 'crypto'

/**
 * Telegram Mini App `initData` verification.
 *
 * A Mini App receives a signed blob describing who opened it. It arrives from
 * the client, so it is untrusted until the signature is checked — without this
 * check anyone could POST a handcrafted `initData` naming any Telegram user and
 * be logged in as them. The algorithm is Telegram's:
 *
 *   secret     = HMAC_SHA256(key = "WebAppData", message = <bot token>)
 *   check_hash = HMAC_SHA256(key = secret, message = <data_check_string>)
 *
 * where data_check_string is every field except `hash`, sorted by key, joined
 * as `k=v` with newlines.
 *
 * Comparison is constant-time, and `auth_date` is age-limited so a leaked
 * initData string cannot be replayed indefinitely.
 */

export interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export interface VerifiedInitData {
  user: TelegramUser
  authDate: Date
  queryId?: string
}

/** initData older than this is rejected as a replay. */
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60

export type InitDataResult =
  | { ok: true; data: VerifiedInitData }
  | { ok: false; reason: 'missing' | 'malformed' | 'bad_signature' | 'expired' | 'no_bot_token' }

export function verifyTelegramInitData(initData: string, botToken?: string): InitDataResult {
  const token = botToken ?? process.env.TELEGRAM_MINIAPP_BOT_TOKEN
  if (!token) return { ok: false, reason: 'no_bot_token' }
  if (!initData) return { ok: false, reason: 'missing' }

  let params: URLSearchParams
  try {
    params = new URLSearchParams(initData)
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const hash = params.get('hash')
  if (!hash) return { ok: false, reason: 'malformed' }

  // Every field except `hash`, sorted by key, joined `k=v` with newlines.
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')

  // Constant-time: a plain === leaks how many leading characters matched.
  const expectedBuf = Buffer.from(expected, 'hex')
  let providedBuf: Buffer
  try {
    providedBuf = Buffer.from(hash, 'hex')
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { ok: false, reason: 'bad_signature' }
  }

  const authDateRaw = Number(params.get('auth_date'))
  if (!Number.isFinite(authDateRaw)) return { ok: false, reason: 'malformed' }
  const ageSeconds = Math.floor(Date.now() / 1000) - authDateRaw
  if (ageSeconds > MAX_AUTH_AGE_SECONDS || ageSeconds < -60) {
    return { ok: false, reason: 'expired' }
  }

  let user: TelegramUser
  try {
    user = JSON.parse(params.get('user') ?? '')
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!user?.id) return { ok: false, reason: 'malformed' }

  return {
    ok: true,
    data: { user, authDate: new Date(authDateRaw * 1000), queryId: params.get('query_id') ?? undefined },
  }
}

/** Display name for a Telegram user, for links and audit rows. */
export function telegramDisplayName(user: TelegramUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return name || user.username || `Telegram ${user.id}`
}
