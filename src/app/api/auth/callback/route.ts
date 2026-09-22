import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestOrigin, safeNextPath } from '@/lib/tenant-handoff'
import { routing } from '@/i18n/routing'

/**
 * The tenant host's end of the sign-in handoff (src/lib/tenant-handoff.ts).
 *
 * Redeems the single-use token minted on the bare host and, in doing so, sets
 * this host's own session cookies — which is the whole point: the cookies the
 * user arrives with belong to a different host and are not sent here.
 *
 * Lives under /api on purpose. src/proxy.ts returns early for /api/**, so this
 * route is reachable without a session; a page route would be bounced to
 * /login by the very gate this request exists to get past.
 */
export const dynamic = 'force-dynamic'

function localeOf(path: string): string {
  const segment = path.split('/')[1] || ''
  return (routing.locales as readonly string[]).includes(segment) ? segment : routing.defaultLocale
}

export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'), `/${routing.defaultLocale}/dashboard`)
  const lang = localeOf(next)
  const token = request.nextUrl.searchParams.get('token')

  // Built from the Host header, not from `request.url`: that one does not
  // carry the host the browser actually asked for, so every bounce from a
  // company host landed back on the bare host — the exact address this route
  // exists to move people off.
  //
  // 303: the browser followed a redirect to get here and must follow this one
  // with a GET, whatever it used before.
  const { host, protocol } = requestOrigin(request.headers)
  const bounce = (path: string) =>
    NextResponse.redirect(new URL(path, `${protocol}//${host}`), { status: 303 })

  if (!token) return bounce(`/${lang}/login`)

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' })
  if (error) {
    // Spent, expired, or meant for another deployment. The login form on this
    // host is the right place to end up — the address is already correct.
    return bounce(`/${lang}/login`)
  }

  return bounce(next)
}
