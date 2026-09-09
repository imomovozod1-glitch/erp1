import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/auth'
import { discoverChat, getTelegramSettings, storeChatId } from '@/lib/integrations/telegram'

/**
 * Works out which chat the connected bot should post to, and remembers it.
 *
 * The whole point is that connecting a bot takes nothing but the BotFather
 * token: Telegram won't tell a bot who owns it, so the admin presses Start in
 * the bot (or adds it to the company group) and this route reads the resulting
 * update. Called by the settings page's "detect" button, and the same
 * resolution happens by itself the first time a notification is sent.
 */
export async function POST() {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settings = await getTelegramSettings(ctx.tenantId)
  if (!settings?.telegram_bot_token) {
    return NextResponse.json({ error: 'not_configured' }, { status: 400 })
  }

  const found = await discoverChat(settings.telegram_bot_token)
  if (!found.ok) {
    return NextResponse.json({ error: 'detect_failed', detail: found.error }, { status: 400 })
  }
  if (!found.data) {
    return NextResponse.json({ error: 'no_chat_yet' }, { status: 404 })
  }

  await storeChatId(ctx.tenantId, found.data.chatId)
  return NextResponse.json({ ok: true, chatId: found.data.chatId, chatTitle: found.data.title })
}
