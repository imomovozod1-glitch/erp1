import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── Fast path: Skip i18n & locale redirects for API routes ───────────────
  if (pathname.startsWith('/api/') || pathname.includes('/api/')) {
    return NextResponse.next()
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
  // Public routes (login, register) don't need JWT validation. Just run the
  // i18n middleware and return — saves ~150 ms on every auth page request.
  if (isPublicRoute) {
    return intlMiddleware(request) ?? NextResponse.next()
  }

  // ─── Protected routes: validate session with Supabase ─────────────────────
  const { supabaseResponse, user } = await updateSession(request)

  // Redirect unauthenticated users to login
  if (!user && pathnameLocale) {
    const locale = pathnameLocale || routing.defaultLocale
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Apply i18n middleware and forward Supabase cookies
  const intlResponse = intlMiddleware(request)
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
