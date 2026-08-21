import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'

const createAdminSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})

/**
 * Vendor-staff provisioning — mirrors src/app/api/admin/tenants/route.ts:
 * service-role auth.admin.createUser() for the login, then an explicit
 * super_admins insert (RLS on that table grants `authenticated` no policy
 * at all, so only this service-role path can ever create a row here).
 */
export async function POST(request: NextRequest) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = createAdminSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
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
    const message = authError?.message?.includes('already registered')
      ? 'This email is already in use'
      : authError?.message || 'Failed to create login'
    return NextResponse.json({ error: message }, { status: 400 })
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
    return NextResponse.json({ error: adminError.message }, { status: 400 })
  }

  return NextResponse.json({ admin }, { status: 201 })
}
