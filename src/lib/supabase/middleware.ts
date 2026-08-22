import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
    const {
      data: { user },
    } = await supabase.auth.getUser()

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
