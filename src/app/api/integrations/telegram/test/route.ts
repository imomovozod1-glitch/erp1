import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/auth'
import { getCachedTenant } from '@/lib/tenant'
import { getTranslations } from 'next-intl/server'
import { normaliseTelegramLanguage } from '@/lib/integrations/telegram-types'
import {
  discoverChat,
  escapeHtml,
  getTelegramSettings,
  sendMessage,
  storeChatId,
} from '@/lib/integrations/telegram'

/**
 * Sends a one-off "connection works" message to the configured chat.
 *
 * Unlike `notifyTelegram`, this reports failures to the caller: the whole
 * point is telling the admin *why* the connection doesn't work (bot not added
 * to the group, wrong chat id, token revoked).
 */
export async function POST() {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const settings = await getTelegramSettings(ctx.tenantId)
  if (!settings?.telegram_bot_token) {
    return NextResponse.json({ error: 'not_configured' }, { status: 400 })
  }

  // Resolve the destination on the spot when it isn't known yet, so "paste the
  // token → press Start → send a test" needs no step in between.
  let chatId = settings.telegram_chat_id
  if (!chatId) {
    const found = await discoverChat(settings.telegram_bot_token)
    if (!found.ok) {
      console.error('[telegram] chat detection failed:', found.error)
      return NextResponse.json({ error: 'detect_failed' }, { status: 400 })
    }
    if (!found.data) return NextResponse.json({ error: 'no_chat_yet' }, { status: 400 })
    chatId = found.data.chatId
    await storeChatId(ctx.tenantId, chatId)
  }

  const tenant = (await getCachedTenant(ctx.tenantId)) as { company_name?: string } | null
  const company = escapeHtml(tenant?.company_name || 'Falco')

  // Same language as every other bot message (see the notify route): the one
  // the company picked for its bot, not the admin's — the test shows exactly
  // what the chat will receive.
  const t = await getTranslations({
    locale: normaliseTelegramLanguage(settings.telegram_language),
    namespace: 'telegramBot',
  })
  const result = await sendMessage(
    settings.telegram_bot_token,
    chatId,
    `✅ <b>${company}</b>\n${t.markup('testConnected', {})}`
  )

  if (!result.ok) {
    console.error('[telegram] test message failed:', result.error)
    return NextResponse.json({ error: 'send_failed' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
