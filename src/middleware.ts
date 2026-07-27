import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password']

function getTenantSubdomain(host: string): string | null {
  // Exclude port if present (e.g. localhost:3000 -> localhost)
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

  // For production domains like "tenant1.urlerp.com"
  const parts = hostname.split('.')
  if (parts.length > 2) {
    const sub = parts[0]
    if (sub !== 'www') return sub
  }

  return null
}

export async function middleware(request: NextRequest) {
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
