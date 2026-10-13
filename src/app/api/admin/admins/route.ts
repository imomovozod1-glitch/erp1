import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { newPasswordSchema } from '@/lib/password-validation'
import { zodErrorCode, isDuplicateLoginError } from '@/lib/admin-errors'
import { adminServerError } from '@/lib/admin-errors-server'

const createAdminSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  password: newPasswordSchema('weak_password'),
})

/**
 * Vendor-staff provisioning — mirrors src/app/api/admin/tenants/route.ts:
 * service-role auth.admin.createUser() for the login, then an explicit
 * super_admins insert (RLS on that table grants `authenticated` no policy
 * at all, so only this service-role path can ever create a row here).
 */
export async function POST(request: NextRequest) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = createAdminSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorCode(parsed.error) }, { status: 400 })
  }
  const input = parsed.data

  const supabase = getCacheClient() as any

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  })
  if (authError || !authData?.user) {
    if (isDuplicateLoginError(authError)) return NextResponse.json({ error: 'email_taken' }, { status: 400 })
    return adminServerError(authError)
  }

  const { data: admin, error: adminError } = await supabase
    .from('super_admins')
    .insert({ id: authData.user.id, full_name: input.full_name, email: input.email })
    .select()
    .single()

  if (adminError) {
    // Roll back the auth user so a failed insert never leaves an orphaned
    // login with no matching super_admins row.
    await supabase.auth.admin.deleteUser(authData.user.id)
    return adminServerError(adminError)
  }

  // getStaffIdentity() caches who is staff for five minutes (src/lib/admin-auth.ts)
  // and the login routes now refuse a sign-in on it, so the cache has to be
  // dropped the moment the answer changes — otherwise a just-created account
  // is told it is not staff, and a just-deleted one still passes the gate.
  revalidateTag(`staff-identity:${authData.user.id}`, { expire: 0 })

  return NextResponse.json({ admin }, { status: 201 })
}
