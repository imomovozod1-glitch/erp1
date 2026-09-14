import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Local JWT verification ───────────────────────────────────────────────────
//
// `supabase.auth.getUser()` asks the Auth server to validate the access token.
// That is a full network round trip — measured at ~500 ms from Tashkent to the
// project's region — and it ran on EVERY protected navigation, before Next.js
// even began rendering. It was the single largest fixed cost in the app.
//
// This project signs its JWTs with an asymmetric key (ES256; see
// /auth/v1/.well-known/jwks.json), so the signature can be verified right here
// with WebCrypto and no network call at all — `getClaims()` does exactly that,
// and still checks the expiry. The security difference against `getUser()` is
// narrow and bounded: a token revoked server-side (signed out elsewhere, user
// deleted) keeps verifying until it expires on its own, at most one access-token
// TTL. The one revocation this app actually acts on — an admin password reset —
// is caught by the force-logout check below, which is unchanged.
//
// The catch is that auth-js caches the JWKS on the CLIENT instance, and
// middleware builds a fresh client per request — so left to itself it would
// simply swap one round trip for another. The key set is therefore cached here,
// in module scope (shared by every request the server process handles), and
// handed to `getClaims()` so it never fetches.
const JWKS_TTL_MS = 10 * 60 * 1000

let cachedJwks: { keys: unknown[] } | null = null
let cachedJwksAt = 0

async function getSigningKeys(supabaseUrl: string, anonKey: string) {
  if (cachedJwks && Date.now() - cachedJwksAt < JWKS_TTL_MS) return cachedJwks
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, {
      headers: { apikey: anonKey },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const jwks = await res.json()
    if (!jwks?.keys?.length) return null
    cachedJwks = jwks
    cachedJwksAt = Date.now()
    return cachedJwks
  } catch {
    // A failed key fetch must not lock anyone out: the caller falls back to
    // getUser(), which is what this replaced.
    return null
  }
}

// The force-logout check below is a second, separate Supabase network round-trip
// (beyond the getUser() JWT validation) that ran on every single protected-route
// request. Its whole purpose is catching a super-admin password reset quickly, so
// unlike the tenant-status gate it can't be cached for long — but a short window
// still eliminates the check on the vast majority of requests during a normal,
// fast-clicking session without meaningfully weakening the force-logout guarantee.
const FORCE_LOGOUT_CHECK_COOKIE = 'flc_cache'
const FORCE_LOGOUT_CHECK_TTL_MS = 20_000

function wasForceLogoutRecentlyChecked(request: NextRequest, userId: string): boolean {
  const raw = request.cookies.get(FORCE_LOGOUT_CHECK_COOKIE)?.value
  if (!raw) return false
  try {
    const parsed: { uid: string; t: number } = JSON.parse(raw)
    return parsed.uid === userId && Date.now() - parsed.t < FORCE_LOGOUT_CHECK_TTL_MS
  } catch {
    return false
  }
}

function markForceLogoutChecked(response: NextResponse, userId: string) {
  response.cookies.set(FORCE_LOGOUT_CHECK_COOKIE, JSON.stringify({ uid: userId, t: Date.now() }), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60,
    path: '/',
  })
}

// A stale `sb-*-auth-token` cookie whose refresh token no longer exists on the
// Auth server (project/keys swapped, user deleted, token already rotated) makes
// every single request log an AuthApiError and never recovers on its own: the
// browser keeps re-sending the same dead cookie. Detect that specific case and
// expire the auth cookies so the next request is cleanly anonymous and lands on
// /login instead of looping through the same failed refresh.
function isDeadRefreshToken(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === 'refresh_token_not_found' ||
    error.code === 'refresh_token_already_used' ||
    /refresh token/i.test(error.message ?? '')
  )
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-') || cookie.name === FORCE_LOGOUT_CHECK_COOKIE) {
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' })
    }
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables (URL/Anon Key) are missing!')
    return { supabaseResponse, user: null }
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: { 
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    // Fast path: verify the token's signature locally. Falls through to
    // getUser() if the key set is unavailable or the token is symmetric.
    const jwks = await getSigningKeys(supabaseUrl, supabaseAnonKey)
    if (jwks) {
      const { data, error } = await supabase.auth.getClaims(undefined, { jwks } as any)
      if (isDeadRefreshToken(error)) {
        clearAuthCookies(request, supabaseResponse)
        return { supabaseResponse, user: null }
      }
      const userId = data?.claims?.sub
      if (!userId) return { supabaseResponse, user: null }

      // The force-logout check needs `last_sign_in_at`, which is not a JWT
      // claim — so the one request in each window that runs that check takes
      // the full getUser() path anyway, and every other request skips both.
      if (wasForceLogoutRecentlyChecked(request, userId)) {
        return { supabaseResponse, user: { id: userId } }
      }
    }

    const { data: { user }, error } = await supabase.auth.getUser()

    if (isDeadRefreshToken(error)) {
      clearAuthCookies(request, supabaseResponse)
      return { supabaseResponse, user: null }
    }

    if (user && !wasForceLogoutRecentlyChecked(request, user.id)) {
      // Force-logout check: if a super-admin reset this user's password more
      // recently than their last actual sign-in, their still-valid access
      // token (stateless JWT, up to ~1h TTL) would otherwise keep working
      // until it expires on its own. See supabase/migration_force_logout.sql
      // and src/app/api/admin/tenants/[id]/reset-password/route.ts.
      const { data: profile } = await supabase
        .from('profiles')
        .select('force_logout_at')
        .eq('id', user.id)
        .maybeSingle()

      const forceLogoutAt = (profile as any)?.force_logout_at
      if (
        forceLogoutAt &&
        user.last_sign_in_at &&
        new Date(forceLogoutAt).getTime() > new Date(user.last_sign_in_at).getTime()
      ) {
        await supabase.auth.signOut()
        return { supabaseResponse, user: null }
      }

      markForceLogoutChecked(supabaseResponse, user.id)
    }

    return { supabaseResponse, user }
  } catch (err) {
    console.error('Failed to get user session in middleware:', err)
    return { supabaseResponse, user: null }
  }
}
