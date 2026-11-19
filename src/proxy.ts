import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'
import { lookupTenant, readGateCookie, touchLastActive, writeGateCookie, type TenantGateInfo } from '@/lib/proxy/tenant-gate'
import { updateSession } from '@/lib/supabase/middleware'
// Shared with the tenant login route, so a sign-in and the gate parse the subdomain the same way.
import { getTenantSubdomain } from '@/lib/tenant-host'

const intlMiddleware = createMiddleware(routing)

const TENANT_STATUS_ROUTE = '/tenant-status'
// /tenant-status must be public: a gone tenant's visitor may have no session, and sending them to
// /login would bounce straight back here — a redirect loop.
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', TENANT_STATUS_ROUTE]

/** Subdomains that are consoles, not tenants (reserved at provisioning), served from their own tree. */
const CONSOLES = ['admin', 'support'] as const

/** Areas outside [lang] with their own auth: no locale redirect, tenant gate or tenant session. */
const SELF_AUTHED = ['/admin', '/tg', '/support']

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)

// admin.<domain>/login keeps its URL while Next.js serves src/app/admin/**; same for support.
function rewriteConsole(request: NextRequest, prefix: string) {
  const url = request.nextUrl.clone()
  if (!url.pathname.startsWith(prefix)) url.pathname = `${prefix}${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}

function localeOf(pathname: string) {
  const locale = routing.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`)
  return { locale, path: locale ? pathname.replace(`/${locale}`, '') || '/' : pathname }
}

function statusRedirect(request: NextRequest, locale: string, reason: string) {
  const url = new URL(`/${locale}${TENANT_STATUS_ROUTE}`, request.url)
  url.searchParams.set('reason', reason)
  return NextResponse.redirect(url)
}

interface Gate {
  tenant: TenantGateInfo | null
  /** The lookup missed the cookie, so the answer is written back onto whatever response goes out. */
  remember: (response: NextResponse) => NextResponse
  /** Set when the visitor must not reach the app at all. */
  refusal?: NextResponse
}

/** A blocked or inactive tenant should not even see a login form, and an unknown subdomain never reaches the app. */
async function tenantGate(request: NextRequest, subdomain: string | null, locale: string, path: string): Promise<Gate> {
  const none: Gate = { tenant: null, remember: (r) => r }
  if (!subdomain || path === TENANT_STATUS_ROUTE) return none
  const cached = readGateCookie(request, subdomain)
  const tenant = cached ?? (await lookupTenant(subdomain))
  const remember = (response: NextResponse) => {
    if (!cached && tenant) writeGateCookie(response, subdomain, tenant)
    return response
  }
  if (!tenant) return { ...none, refusal: statusRedirect(request, locale, 'not-found') }
  if (tenant.status !== 'active') return { tenant, remember, refusal: remember(statusRedirect(request, locale, tenant.status === 'blocked' ? 'blocked' : 'inactive')) }
  return { tenant, remember }
}

async function protectedResponse(request: NextRequest, forwarded: NextRequest, gate: Gate, locale: string | undefined) {
  const { supabaseResponse, user } = await updateSession(forwarded)
  if (!user && locale) {
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return gate.remember(NextResponse.redirect(loginUrl))
  }
  if (user && gate.tenant) touchLastActive(request, supabaseResponse, gate.tenant.id)
  gate.remember(supabaseResponse)
  const intlResponse = intlMiddleware(forwarded)
  if (!intlResponse) return supabaseResponse
  supabaseResponse.cookies.getAll().forEach((cookie) => intlResponse.cookies.set(cookie.name, cookie.value, cookie))
  return intlResponse
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const subdomain = getTenantSubdomain(request.headers.get('host') || '')
  const consolePrefix = CONSOLES.find((name) => name === subdomain)
  if (consolePrefix) return rewriteConsole(request, `/${consolePrefix}`)

  const headers = new Headers(request.headers)
  if (subdomain) headers.set('x-tenant-subdomain', subdomain)
  const forwarded = new NextRequest(request, { headers })
  const passThrough = () => NextResponse.next({ request: { headers } })
  if (pathname.includes('/api/') || SELF_AUTHED.some((prefix) => under(pathname, prefix))) return passThrough()

  const { locale, path } = localeOf(pathname)
  // `/<lang>` on the bare host is the public landing page; on a tenant it still redirects to the dashboard.
  const isPublic = (!subdomain && path === '/') || PUBLIC_ROUTES.some((route) => under(path, route))
  const gate = await tenantGate(request, subdomain, locale || routing.defaultLocale, path)
  if (gate.refusal) return gate.refusal
  // Public routes skip the Supabase session check entirely.
  if (isPublic) return gate.remember(intlMiddleware(forwarded) ?? passThrough())
  return protectedResponse(request, forwarded, gate, locale)
}

export const config = {
  matcher: [
    // Everything except Next.js internals, API routes and static files; `.html` is excluded so
    // public/offline.html (the Capacitor shell's offline page) is not bounced to /uz/offline.html.
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)',
  ],
}
