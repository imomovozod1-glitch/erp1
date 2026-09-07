import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { verifyTelegramInitData } from '@/lib/telegram-miniapp'

const schema = z.object({ initData: z.string().min(1).max(4096) })

/**
 * Mini App sign-in. Verifies the Telegram signature and reports whether this
 * Telegram account is already bound to an ERP profile.
 *
 * It deliberately does NOT create a Supabase session by itself: this route can
 * prove *which Telegram user* is calling, but that is not the same as proving
 * they own an ERP account. The binding is established once via /link, which
 * requires the user's real phone + password. After that this route returns the
 * subdomain to open, and the Mini App loads the normal app in that context.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const verified = verifyTelegramInitData(parsed.data.initData)
  if (!verified.ok) {
    // 'no_bot_token' is a server misconfiguration, not a caller error.
    const status = verified.reason === 'no_bot_token' ? 500 : 401
    return NextResponse.json({ error: verified.reason }, { status })
  }

  const supabase = getCacheClient() as any
  const { data: link } = await supabase
    .from('telegram_links')
    .select('profile_id, tenant_id, tenants(subdomain, company_name, status)')
    .eq('telegram_user_id', verified.data.user.id)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({
      linked: false,
      telegramName: verified.data.user.first_name ?? null,
    })
  }

  // Touch last-seen; a failure here must not block sign-in.
  await supabase
    .from('telegram_links')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('telegram_user_id', verified.data.user.id)

  return NextResponse.json({
    linked: true,
    subdomain: link.tenants?.subdomain ?? null,
    companyName: link.tenants?.company_name ?? null,
    tenantStatus: link.tenants?.status ?? null,
  })
}
