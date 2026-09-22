import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { HANDOFF_SKIP_COOKIE, createTenantHandoff, requestOrigin, safeNextPath } from '@/lib/tenant-handoff'
import { routing } from '@/i18n/routing'

/**
 * The bare host's end of the sign-in handoff (src/lib/tenant-handoff.ts):
 * takes the session established here and moves it to the company's own host.
 *
 * Reached two ways — from the dashboard layout, when a session turns up on a
 * host that serves no company, and straight after a sign-in that happened
 * here (the Capacitor shell and the Telegram Mini App both open the bare
 * host). Either way the session does not stay: the company workspace is only
 * ever rendered on the company's address, which is what makes the
 * subscription gate in src/proxy.ts unavoidable.
 */
export const dynamic = 'force-dynamic'

function localeOf(path: string): string {
  const segment = path.split('/')[1] || ''
  return (routing.locales as readonly string[]).includes(segment) ? segment : routing.defaultLocale
}

export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'), `/${routing.defaultLocale}/dashboard`)
  const lang = localeOf(next)
  // From the Host header rather than `request.url`, which does not carry the
  // host the browser asked for.
  const { host, protocol } = requestOrigin(request.headers)
  const bounce = (path: string) =>
    NextResponse.redirect(new URL(path, `${protocol}//${host}`), { status: 303 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return bounce(`/${lang}/login`)

  const result = await createTenantHandoff({
    userId: user.id,
    email: user.email,
    requestHost: host,
    protocol,
    next,
  })

  if (!result.ok) {
    if (result.reason === 'tenant_blocked') {
      // Shown here rather than on the company host: that host is exactly what
      // this session is not getting. Only the two reasons that page knows are
      // passed on; any other stored status would render as "not found".
      const reason = result.status === 'inactive' ? 'inactive' : 'blocked'
      return bounce(`/${lang}/tenant-status?reason=${reason}`)
    }
    if (result.reason === 'no_tenant') {
      await supabase.auth.signOut({ scope: 'local' })
      return bounce(`/${lang}/login`)
    }
    // 'unavailable': the token could not be minted (a preview deployment with
    // no company hosts never reaches this route — the layout checks for that
    // first). Leaving the session where it is beats stranding the user, but
    // the layout sends every bare-host session straight back here, so without
    // a marker the two would bounce off each other forever. The cookie is that
    // marker: one short window of working on the bare host, then it tries
    // again. Unsigned on purpose — it can only ever cost a redirect.
    const response = bounce(next)
    response.cookies.set(HANDOFF_SKIP_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60,
      path: '/',
    })
    return response
  }

  // Local scope: this drops the cookies on THIS host only. A global sign-out
  // would revoke every refresh token the person has, logging them out of the
  // phone in their pocket because they opened the apex on a laptop.
  await supabase.auth.signOut({ scope: 'local' })

  return NextResponse.redirect(result.target.url, { status: 303 })
}
