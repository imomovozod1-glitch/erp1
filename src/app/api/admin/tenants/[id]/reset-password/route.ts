import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { newPasswordSchema } from '@/lib/password-validation'
import { resolveTenantOwner } from '@/lib/tenant-owner'

// Same strength policy as every other place a password is SET
// (src/lib/password-validation.ts) — a 6-digit numeric password used to slip
// through here even though the UI refuses to submit one.
const schema = z.object({ password: newPasswordSchema('weak') })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Password does not meet strength requirements' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, phone, owner_user_id')
    .eq('id', id)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // The account the login page signs into for this tenant's phone — see
  // src/lib/tenant-owner.ts. Resetting the password of any other account (the
  // old "first admin profile" fallback could pick one) left the owner locked out.
  const owner = await resolveTenantOwner(supabase, tenant)
  if (!owner) {
    return NextResponse.json({ error: 'Tenant has no owner login' }, { status: 404 })
  }

  // If the owner's login email drifted from the tenant's phone, put it back in
  // the same call, so the phone shown in the admin panel is the one that works.
  const { data: updated, error } = await supabase.auth.admin.updateUserById(owner.userId, {
    password: parsed.data.password,
    ...(owner.emailMatches ? {} : { email: owner.loginEmail, email_confirm: true }),
  })
  if (error) {
    const message = /already.*registered|already exists|email_exists/i.test(error.message)
      ? 'Another login already uses this phone number'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  await Promise.all([
    tenant.owner_user_id === owner.userId
      ? Promise.resolve()
      : supabase.from('tenants').update({ owner_user_id: owner.userId }).eq('id', id),
    // Kick any currently-open session for this user immediately — see
    // supabase/migration_force_logout.sql and src/lib/supabase/middleware.ts.
    // The timestamp comes from the Auth server (the same clock that stamps
    // `last_sign_in_at`), so a small clock difference with this server can
    // never make the owner's next, fresh sign-in look older than the reset.
    supabase
      .from('profiles')
      .update({
        force_logout_at: updated?.user?.updated_at ?? new Date().toISOString(),
        ...(owner.emailMatches ? {} : { email: owner.loginEmail }),
      })
      .eq('id', owner.userId),
  ])

  return NextResponse.json({ success: true })
}
