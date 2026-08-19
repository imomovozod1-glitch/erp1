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
 * Lightweight, UNCACHED tenant lookup for the Edge middleware gate.
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
  if (tenantSubdomain && pathWithoutLocale !== TENANT_STATUS_ROUTE) {
    gatedTenant = await getTenantBySubdomain(tenantSubdomain)
    const locale = pathnameLocale || routing.defaultLocale

    if (!gatedTenant) {
      const url = new URL(`/${locale}${TENANT_STATUS_ROUTE}`, request.url)
      url.searchParams.set('reason', 'not-found')
      return NextResponse.redirect(url)
    }
    if (gatedTenant.status !== 'active') {
      const url = new URL(`/${locale}${TENANT_STATUS_ROUTE}`, request.url)
      url.searchParams.set('reason', gatedTenant.status === 'blocked' ? 'blocked' : 'inactive')
      return NextResponse.redirect(url)
    }
  }

  // ─── Fast path: skip Supabase network call for public routes ──────────────
  if (isPublicRoute) {
    const response = intlMiddleware(reqWithHeaders) ?? NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    })
    return response
  }

  // ─── Protected routes: validate session with Supabase ─────────────────────
  const { supabaseResponse, user } = await updateSession(reqWithHeaders)

  // Redirect unauthenticated users to login
  if (!user && pathnameLocale) {
    const locale = pathnameLocale || routing.defaultLocale
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && gatedTenant) {
    touchTenantLastActive(gatedTenant.id)
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
