import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

    if (user) {
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
    }

    return { supabaseResponse, user }
  } catch (err) {
    console.error('Failed to get user session in middleware:', err)
    return { supabaseResponse, user: null }
  }
}
