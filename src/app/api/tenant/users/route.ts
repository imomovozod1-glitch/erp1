import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getVerifiedUser, getCachedProfile } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { newPasswordSchema } from '@/lib/password-validation'
import { phoneSchema } from '@/lib/phone-validation'
import { memberLoginEmail, phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { pickKnownPermissions } from '@/lib/permissions'
// A partial map keyed by module — z.record() with an enum key requires
// every enum key to be present (Zod v4), but the client only ever sends
// entries for modules the admin actually touched in the checkbox matrix.
// Loose per module: pickKnownPermissions normalises the action set, so a stricter
// shape here only drops what the matrix sent (create, delete, export, scope).
const permissionsSchema = z.record(z.string(), z.record(z.string(), z.unknown())).optional()

const createUserSchema = z.object({
  full_name: z.string().min(1),
  phone: phoneSchema('weak'),
  password: newPasswordSchema('weak'),
  permissions: permissionsSchema,
  role_template_id: z.string().uuid().nullable().optional(),
  is_paid: z.boolean(),
})

/**
 * Lets a tenant admin create a brand-new login for a co-worker directly
 * from the HR "Add Employee" flow — the same-tenant counterpart to
 * `/api/admin/tenants` (which provisions a whole tenant's *owner* login and
 * is vendor/super-admin-only). Tenant users authenticate over the browser
 * client, which has no access to `auth.admin.*`, so account creation always
 * has to go through a server route using the service-role key — scoped to
 * the caller's own tenant_id (from their DB-backed profile, never trusted
 * from the request body) so one tenant admin can never provision a login
 * inside another tenant.
 */
export async function POST(request: NextRequest) {
  const user = await getVerifiedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const callerProfile = await getCachedProfile(user.id) as any
  if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.tenant_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const input = parsed.data

  // A "free" (non-paid) employee cannot be given a system login at all —
  // see the is_paid checkbox in employee-form.tsx, which is meant to keep
  // this route from ever being reachable in that state client-side. This
  // is the same client-supplied-flag trust level as the rest of the
  // permissions system (admin-only route already gated above), not a new
  // security gap.
  if (!input.is_paid) {
    return NextResponse.json({ error: 'employee_not_paid' }, { status: 403 })
  }

  const supabase = getCacheClient() as any

  // `role_templates.id` is a plain FK with no tenant constraint, so an id from
  // another tenant would be accepted and stored here. Nothing else re-checks it,
  // so verify ownership before it can be attached to a profile.
  if (input.role_template_id) {
    const { data: template } = await supabase
      .from('role_templates')
      .select('id')
      .eq('id', input.role_template_id)
      .eq('tenant_id', callerProfile.tenant_id)
      .maybeSingle()
    if (!template) {
      return NextResponse.json({ error: 'invalid_role_template' }, { status: 400 })
    }
  }

  // Scoped to this company (src/lib/tenant-auth.ts): the number may equal the
  // company's own phone, or a phone in any other company, without colliding.
  // Only a second login with the same number in THIS company is refused.
  const email = memberLoginEmail(input.phone, callerProfile.tenant_id)

  // A member from before scoped logins holds the GLOBAL address; with the same
  // number in this company that is still a duplicate. The company's owner
  // holding it is not — a member may share the company's own phone.
  const { data: legacy } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', callerProfile.tenant_id)
    .eq('email', phoneToSyntheticEmail(input.phone))
  if (legacy?.length) {
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('owner_user_id')
      .eq('id', callerProfile.tenant_id)
      .maybeSingle()
    if (legacy.some((row: { id: string }) => row.id !== tenantRow?.owner_user_id)) {
      return NextResponse.json({ error: 'phone_taken' }, { status: 400 })
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { tenant_id: callerProfile.tenant_id, full_name: input.full_name },
  })

  if (authError || !authData?.user) {
    const taken =
      authError?.code === 'email_exists' ||
      authError?.code === 'user_already_exists' ||
      authError?.message?.includes('already registered')
    if (taken) return NextResponse.json({ error: 'phone_taken' }, { status: 400 })
    console.error('[tenant/users] createUser failed:', authError?.message)
    return NextResponse.json({ error: 'server_error' }, { status: 400 })
  }

  // handle_new_user() already set tenant_id/full_name/role='staff' from the
  // metadata above — phone and the module permissions still need a direct
  // write since the trigger doesn't know about either.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      phone: input.phone,
      permissions: pickKnownPermissions(input.permissions) ?? {},
      role_template_id: input.role_template_id ?? null,
    })
    .eq('id', authData.user.id)

  if (profileError) {
    // Roll back the auth user so a failed profile update never leaves an
    // orphaned login with no matching, fully-set-up profile.
    await supabase.auth.admin.deleteUser(authData.user.id)
    console.error('[tenant/users] profile update failed:', profileError.message)
    return NextResponse.json({ error: 'server_error' }, { status: 400 })
  }

  return NextResponse.json(
    {
      profile: {
        id: authData.user.id,
        full_name: input.full_name,
        email,
        phone: input.phone,
        role: 'staff',
        permissions: pickKnownPermissions(input.permissions) ?? {},
      },
    },
    { status: 201 }
  )
}
