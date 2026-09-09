import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/auth'
import { getCachedTenant } from '@/lib/tenant'
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
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
      return NextResponse.json({ error: 'detect_failed', detail: found.error }, { status: 400 })
    }
    if (!found.data) return NextResponse.json({ error: 'no_chat_yet' }, { status: 400 })
    chatId = found.data.chatId
    await storeChatId(ctx.tenantId, chatId)
  }

  const tenant = (await getCachedTenant(ctx.tenantId)) as { company_name?: string } | null
  const company = escapeHtml(tenant?.company_name || 'ERP')

  const result = await sendMessage(
    settings.telegram_bot_token,
    chatId,
    `✅ <b>${company}</b>\nTelegram integration connected successfully.`
  )

  if (!result.ok) {
    return NextResponse.json({ error: 'send_failed', detail: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
