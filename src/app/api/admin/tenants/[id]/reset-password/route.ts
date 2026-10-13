import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { newPasswordSchema } from '@/lib/password-validation'
import { resolveTenantOwner } from '@/lib/tenant-owner'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { isDuplicateLoginError } from '@/lib/admin-errors'
import { adminServerError } from '@/lib/admin-errors-server'
import { freeGlobalLogin } from '@/lib/phone-login'

// Same strength policy as every other place a password is SET
// (src/lib/password-validation.ts) — a 6-digit numeric password used to slip
// through here even though the UI refuses to submit one.
const schema = z.object({ password: newPasswordSchema('weak_password') })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, phone, owner_user_id, company_name')
    .eq('id', id)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })

  // The account the login page signs into for this tenant's phone — see
  // src/lib/tenant-owner.ts. Resetting the password of any other account (the
  // old "first admin profile" fallback could pick one) left the owner locked out.
  const owner = await resolveTenantOwner(supabase, tenant)
  if (!owner) {
    // No account belongs to this tenant at all (its owner was deleted, or an
    // older provisioning never created one), so there is nothing to reset —
    // create the owner login now with this password, exactly as provisioning
    // does (src/app/api/admin/tenants/route.ts). Answering "no owner" instead
    // left the company with no way back in short of the database.
    const loginEmail = phoneToSyntheticEmail(tenant.phone)
    // A member (of this or another company) may still hold that login from
    // before member logins were company-scoped: move them to their own first.
    const freed = await freeGlobalLogin(tenant.phone, tenant.id, null)
    if (!freed.ok) return NextResponse.json({ error: freed.error }, { status: 409 })
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: loginEmail,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { tenant_id: tenant.id, full_name: tenant.company_name },
    })
    if (createError || !created?.user) {
      // Still held after freeGlobalLogin: a support agent or another
      // company's owner — a real conflict, the tenant's phone has to change.
      if (isDuplicateLoginError(createError)) return NextResponse.json({ error: 'phone_taken' }, { status: 409 })
      return adminServerError(createError ?? 'createUser returned no user')
    }
    await Promise.all([
      supabase.from('profiles').update({ role: 'admin', phone: tenant.phone }).eq('id', created.user.id),
      supabase.from('tenants').update({ owner_user_id: created.user.id }).eq('id', id),
    ])
    return NextResponse.json({ success: true })
  }

  // If the owner's login email drifted from the tenant's phone, put it back in
  // the same call, so the phone shown in the admin panel is the one that works.
  if (!owner.emailMatches) {
    const freed = await freeGlobalLogin(tenant.phone, tenant.id, owner.userId)
    if (!freed.ok) return NextResponse.json({ error: freed.error }, { status: 409 })
  }
  const { data: updated, error } = await supabase.auth.admin.updateUserById(owner.userId, {
    password: parsed.data.password,
    ...(owner.emailMatches ? {} : { email: owner.loginEmail, email_confirm: true }),
  })
  if (error) {
    if (isDuplicateLoginError(error)) return NextResponse.json({ error: 'phone_taken' }, { status: 409 })
    return adminServerError(error)
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
