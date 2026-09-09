import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import {
  TELEGRAM_EVENTS,
  discoverChat,
  getBotInfo,
  getTelegramSettings,
  isValidBotTokenFormat,
  isValidChatIdFormat,
  maskToken,
} from '@/lib/integrations/telegram'

/**
 * Read/save/disconnect this tenant's Telegram bot integration.
 *
 * Admin-only, and always server-side: `integration_settings` has no
 * `authenticated` RLS policy (supabase/migration_integrations.sql), so the
 * bot token is only reachable through the service-role client here. GET
 * returns a masked hint and never the token itself.
 */

// String-keyed, not `z.record(z.enum(TELEGRAM_EVENTS), ...)`: in Zod v4 an
// enum-keyed record requires EVERY enum member to be present, so a partial map
// (the UI only sends events the admin actually toggled) is rejected outright.
// Same trap already documented in /api/tenant/users. Unknown keys are dropped
// by `pickKnownEvents` below rather than stored.
const eventsSchema = z.record(z.string(), z.boolean()).optional()

function pickKnownEvents(events: Record<string, boolean> | undefined) {
  if (!events) return undefined
  const known: Record<string, boolean> = {}
  for (const event of TELEGRAM_EVENTS) {
    if (typeof events[event] === 'boolean') known[event] = events[event]
  }
  return known
}

const saveSchema = z.object({
  // Omitted on a re-save when the admin didn't retype the token — the stored
  // one is then kept, so changing settings doesn't require pasting the secret
  // again (the UI can't show it back to them to begin with).
  bot_token: z.string().trim().min(1).optional(),
  // Optional on purpose: connecting a bot should need nothing but the token
  // from BotFather. The chat is discovered from the bot's own update queue
  // once someone presses Start or adds it to a group. Supplying it by hand
  // stays possible for setups where that isn't practical (e.g. a channel the
  // bot posts to but nobody writes in).
  chat_id: z.string().trim().optional(),
  enabled: z.boolean(),
  events: eventsSchema,
})

async function requireAdmin() {
  const ctx = await getTenantContext()
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (ctx.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ctx }
}

export async function GET() {
  const { ctx, error } = await requireAdmin()
  if (error) return error

  const settings = await getTelegramSettings(ctx!.tenantId)

  return NextResponse.json({
    // Connected = we hold a working token. Whether a destination chat is known
    // yet is reported separately, because that part resolves itself.
    connected: !!settings?.telegram_bot_token,
    awaitingChat: !!settings?.telegram_bot_token && !settings?.telegram_chat_id,
    enabled: settings?.telegram_enabled ?? false,
    chatId: settings?.telegram_chat_id ?? '',
    botUsername: settings?.telegram_bot_username ?? null,
    // Masked — the raw token is never returned to the browser.
    tokenHint: maskToken(settings?.telegram_bot_token),
    events: settings?.telegram_events ?? {},
    linkedAt: settings?.telegram_linked_at ?? null,
  })
}

export async function PUT(request: NextRequest) {
  const { ctx, error } = await requireAdmin()
  if (error) return error
  const tenantId = ctx!.tenantId

  const body = await request.json().catch(() => null)
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const input = parsed.data

  if (input.chat_id && !isValidChatIdFormat(input.chat_id)) {
    return NextResponse.json({ error: 'invalid_chat_id' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const existing = await getTelegramSettings(tenantId)
  const token = input.bot_token ?? existing?.telegram_bot_token ?? null

  if (!token) return NextResponse.json({ error: 'token_required' }, { status: 400 })
  if (!isValidBotTokenFormat(token)) {
    return NextResponse.json({ error: 'invalid_token_format' }, { status: 400 })
  }

  // Verify the token against Telegram before storing it, so a typo is caught
  // here instead of silently swallowing every future notification (notifyTelegram
  // never throws by design).
  const info = await getBotInfo(token)
  if (!info.ok) {
    return NextResponse.json({ error: 'token_rejected', detail: info.error }, { status: 400 })
  }

  // No chat given: try to work it out from the bot's pending updates. A brand
  // new bot has none yet, which is fine — the row is still saved and the chat
  // resolves on the first Start (see notifyTelegram / the detect-chat route).
  let chatId = input.chat_id?.trim() || existing?.telegram_chat_id || null
  let discoveredTitle: string | null = null
  if (!chatId) {
    const found = await discoverChat(token)
    if (found.ok && found.data) {
      chatId = found.data.chatId
      discoveredTitle = found.data.title
    }
  }

  const { error: upsertError } = await supabase
    .from('integration_settings')
    .upsert(
      {
        tenant_id: tenantId,
        telegram_bot_token: token,
        telegram_chat_id: chatId,
        telegram_bot_username: info.data.username,
        telegram_enabled: input.enabled,
        telegram_events: pickKnownEvents(input.events) ?? existing?.telegram_events ?? {},
        telegram_linked_at: existing?.telegram_linked_at ?? new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    botUsername: info.data.username,
    chatId,
    chatTitle: discoveredTitle,
    awaitingChat: !chatId,
  })
}

export async function DELETE() {
  const { ctx, error } = await requireAdmin()
  if (error) return error

  const supabase = getCacheClient() as any
  // Clear the credentials rather than deleting the row, so the tenant's event
  // preferences survive a disconnect/reconnect cycle.
  const { error: updateError } = await supabase
    .from('integration_settings')
    .update({
      telegram_bot_token: null,
      telegram_chat_id: null,
      telegram_bot_username: null,
      telegram_enabled: false,
      telegram_linked_at: null,
    })
    .eq('tenant_id', ctx!.tenantId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
