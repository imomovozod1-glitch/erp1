import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { routing } from '@/i18n/routing'
import { computeEffectiveStatus } from '@/lib/tenant-status'

const intlMiddleware = createMiddleware(routing)

const TENANT_STATUS_ROUTE = '/tenant-status'
// /tenant-status must be public: it's shown to visitors who may have no
// session at all (a blocked/gone tenant's subdomain) — requiring auth here
// would bounce them to /login, which the tenant gate then bounces right back
// to /tenant-status, an infinite redirect loop.
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', TENANT_STATUS_ROUTE]

interface TenantGateInfo {
  id: string
  status: string
}

// Every request under a tenant subdomain previously paid for a fresh,
// uncached Supabase REST round-trip here (measured ~650-750ms per call from
// a typical dev network path) — on top of the auth session check right
// after it, that's up to ~1.5-2s of pure network wait before Next.js even
// starts rendering the page, on every single navigation. A tenant's status
// only ever changes via a deliberate admin action, so a short-lived cookie
// cache removes that cost for the overwhelming majority of requests while
// still catching a newly-blocked tenant within one cache window.
//
// Not cryptographically signed: forging this cookie only ever bypasses the
// *billing* gate (subscription lapsed), never RLS/data isolation, which is
// enforced independently at the database layer regardless of this cookie.
// The short TTL bounds how long that forgery could matter.
const TENANT_GATE_COOKIE = 'tg_cache'
const TENANT_GATE_TTL_MS = 30_000

interface TenantGateCacheEntry {
  s: string // subdomain this entry is valid for
  id: string
  st: string // status
  t: number // cached-at, ms epoch
}

function readTenantGateCache(request: NextRequest, subdomain: string): TenantGateInfo | null {
  const raw = request.cookies.get(TENANT_GATE_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed: TenantGateCacheEntry = JSON.parse(raw)
    if (parsed.s !== subdomain) return null
    if (Date.now() - parsed.t > TENANT_GATE_TTL_MS) return null
    return { id: parsed.id, status: parsed.st }
  } catch {
    return null
  }
}

function writeTenantGateCache(response: NextResponse, subdomain: string, tenant: TenantGateInfo) {
  const entry: TenantGateCacheEntry = { s: subdomain, id: tenant.id, st: tenant.status, t: Date.now() }
  response.cookies.set(TENANT_GATE_COOKIE, JSON.stringify(entry), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60,
    path: '/',
  })
}

/** Fire-and-forget PATCH against the service-role REST API — never blocks the response on this. */
function patchTenant(tenantId: string, body: Record<string, unknown>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return

  fetch(`${supabaseUrl}/rest/v1/tenants?id=eq.${tenantId}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  }).catch(() => {})
}

/**
 * Lightweight, UNCACHED-AT-THE-FETCH-LEVEL tenant lookup for the Edge
 * middleware gate — callers should check `readTenantGateCache` first (see
 * above) so this only actually runs on a cache miss.
 *
 * Deliberately NOT `getCachedTenant()`/`unstable_cache` (src/lib/tenant.ts) —
 * that depends on Next's workAsyncStorage/incrementalCache, which isn't
 * guaranteed available in Edge middleware and can throw there. Uses the
 * service-role key directly (never exposed to the browser — this file only
 * runs server-side) since RLS on `tenants` only grants `authenticated`-role
 * policies scoped to the caller's own tenant, and this check has to run
 * before we know who (if anyone) is logged in.
 *
 * Also enforces the active→blocked transition on a lapsed, unpaid
 * subscription right here — this is the one check every request actually
 * goes through, so it's the authoritative place for that, not a decorative
 * status computed only in the admin UI (see src/lib/tenant-status.ts).
 */
async function getTenantBySubdomain(subdomain: string): Promise<TenantGateInfo | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/tenants?subdomain=eq.${encodeURIComponent(subdomain)}&select=id,status,subscription_ends_at`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        cache: 'no-store',
      }
    )
    if (!res.ok) return null
    const rows: (TenantGateInfo & { subscription_ends_at: string | null })[] = await res.json()
    const tenant = rows[0] ?? null
    if (!tenant) return null

    const effectiveStatus = computeEffectiveStatus(tenant.status, tenant.subscription_ends_at)
    if (effectiveStatus !== tenant.status) {
      patchTenant(tenant.id, { status: effectiveStatus })
    }
    return { id: tenant.id, status: effectiveStatus }
  } catch {
    return null
  }
}

/** Fire-and-forget — never blocks the response on this. */
function touchTenantLastActive(tenantId: string) {
  patchTenant(tenantId, { last_active_at: new Date().toISOString() })
}

function getTenantSubdomain(host: string): string | null {
  const hostname = host.split(':')[0]

  // If local development, check for subdomain before "localhost"
  // e.g. "tenant1.localhost" -> "tenant1"
  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.')
    if (parts.length > 1) {
      const sub = parts[0]
      if (sub !== 'www') return sub
    }
    return null
  }

  // The app's own deployment domain (e.g. "erp1-livid.vercel.app") is not a
  // tenant subdomain, even though it has 3+ dot-separated parts just like a
  // real one ("acme.urlerp.com") would — without this, the platform's own
  // default/preview domain gets misread as an unknown tenant on every visit.
  // Real tenant subdomains only ever live on the app's own custom domain.
  if (hostname === 'vercel.app' || hostname.endsWith('.vercel.app')) {
    return null
  }

  // For production domains like "tenant1.urlerp.com"
  const parts = hostname.split('.')
  if (parts.length > 2) {
    const sub = parts[0]
    if (sub !== 'www') return sub
  }

  return null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Extract host and check for subdomain
  const host = request.headers.get('host') || ''
  const tenantSubdomain = getTenantSubdomain(host)

  // admin.<domain> is the super-admin console, not a tenant — rewrite to the
  // same /admin path tree that already works at <domain>/admin/** (see the
  // path-based bypass further below), so the URL bar still shows
  // admin.<domain>/login while Next.js actually serves src/app/admin/**.
  // "admin" can never collide with a real tenant subdomain: tenants are
  // only ever created via the provisioning route, which never accepts it
  // (reserved, see src/app/api/admin/tenants/route.ts).
  if (tenantSubdomain === 'admin') {
    const url = request.nextUrl.clone()
    if (!pathname.startsWith('/admin')) {
      url.pathname = `/admin${pathname === '/' ? '' : pathname}`
    }
    return NextResponse.rewrite(url)
  }

  // Clone headers and append tenant context if present
  const requestHeaders = new Headers(request.headers)
  if (tenantSubdomain) {
    requestHeaders.set('x-tenant-subdomain', tenantSubdomain)
  }

  // Create a new request with the updated headers
  const reqWithHeaders = new NextRequest(request, {
    headers: requestHeaders,
  })

  // ─── Fast path: Skip i18n & locale redirects for API routes ───────────────
  if (pathname.startsWith('/api/') || pathname.includes('/api/')) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    })
  }

  // ─── Fast path: the super-admin console lives outside [lang] entirely and
  // has its own auth model (super_admins, not profiles/RLS) — never run
  // locale redirects, tenant-subdomain gating, or tenant auth against it.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    })
  }

  // Extract locale from pathname
  const pathnameLocale = routing.locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  // Get the path without locale
  const pathWithoutLocale = pathnameLocale
    ? pathname.replace(`/${pathnameLocale}`, '') || '/'
    : pathname

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`)
  )

  // ─── Tenant status gate ────────────────────────────────────────────────────
  // Runs for every route under a resolved tenant subdomain (including public
  // ones like /login) — a blocked/inactive tenant shouldn't even see a login
  // form, and a subdomain matching no tenant at all shouldn't reach the app.
  let gatedTenant: TenantGateInfo | null = null
  let tenantGateNeedsWrite = false
  if (tenantSubdomain && pathWithoutLocale !== TENANT_STATUS_ROUTE) {
    gatedTenant = readTenantGateCache(request, tenantSubdomain)
    if (!gatedTenant) {
      gatedTenant = await getTenantBySubdomain(tenantSubdomain)
      tenantGateNeedsWrite = gatedTenant != null
    }
    const locale = pathnameLocale || routing.defaultLocale

    if (!gatedTenant) {
      const url = new URL(`/${locale}${TENANT_STATUS_ROUTE}`, request.url)
      url.searchParams.set('reason', 'not-found')
      return NextResponse.redirect(url)
    }
    if (gatedTenant.status !== 'active') {
      const url = new URL(`/${locale}${TENANT_STATUS_ROUTE}`, request.url)
      url.searchParams.set('reason', gatedTenant.status === 'blocked' ? 'blocked' : 'inactive')
      const response = NextResponse.redirect(url)
      if (tenantGateNeedsWrite) writeTenantGateCache(response, tenantSubdomain as string, gatedTenant)
      return response
    }
  }

  // ─── Fast path: skip Supabase network call for public routes ──────────────
  if (isPublicRoute) {
    const response = intlMiddleware(reqWithHeaders) ?? NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    })
    if (tenantGateNeedsWrite && gatedTenant && tenantSubdomain) {
      writeTenantGateCache(response, tenantSubdomain, gatedTenant)
    }
    return response
  }

  // ─── Protected routes: validate session with Supabase ─────────────────────
  const { supabaseResponse, user } = await updateSession(reqWithHeaders)

  // Redirect unauthenticated users to login
  if (!user && pathnameLocale) {
    const locale = pathnameLocale || routing.defaultLocale
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    const response = NextResponse.redirect(loginUrl)
    if (tenantGateNeedsWrite && gatedTenant && tenantSubdomain) {
      writeTenantGateCache(response, tenantSubdomain, gatedTenant)
    }
    return response
  }

  if (user && gatedTenant) {
    touchTenantLastActive(gatedTenant.id)
  }

  if (tenantGateNeedsWrite && gatedTenant && tenantSubdomain) {
    writeTenantGateCache(supabaseResponse, tenantSubdomain, gatedTenant)
  }

  // Apply i18n middleware and forward Supabase cookies
  const intlResponse = intlMiddleware(reqWithHeaders)
  if (intlResponse) {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return intlResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all pathnames except for Next.js internals and API routes
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
