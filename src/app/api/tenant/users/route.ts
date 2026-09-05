import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { newPasswordSchema } from '@/lib/password-validation'
import { phoneSchema } from '@/lib/phone-validation'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'
const modulePermissionSchema = z.object({ view: z.boolean(), edit: z.boolean() })
// A partial map keyed by module — z.record() with an enum key requires
// every enum key to be present (Zod v4), but the client only ever sends
// entries for modules the admin actually touched in the checkbox matrix.
const permissionsSchema = z.record(z.string(), modulePermissionSchema).optional()

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
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerProfile = await getCachedProfile(user.id) as any
  if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.tenant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const input = parsed.data

  // A "free" (non-paid) employee cannot be given a system login at all —
  // see the is_paid checkbox in employee-form.tsx, which is meant to keep
  // this route from ever being reachable in that state client-side. This
  // is the same client-supplied-flag trust level as the rest of the
  // permissions system (admin-only route already gated above), not a new
  // security gap.
  if (!input.is_paid) {
    return NextResponse.json({ error: 'Only paid employees can be given a system login' }, { status: 403 })
  }

  const supabase = getCacheClient() as any
  const email = phoneToSyntheticEmail(input.phone)

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { tenant_id: callerProfile.tenant_id, full_name: input.full_name },
  })

  if (authError || !authData?.user) {
    const message = authError?.message?.includes('already registered')
      ? 'This phone number is already in use'
      : authError?.message || 'Failed to create login'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // handle_new_user() already set tenant_id/full_name/role='staff' from the
  // metadata above — phone and the module permissions still need a direct
  // write since the trigger doesn't know about either.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      phone: input.phone,
      permissions: input.permissions ?? {},
      role_template_id: input.role_template_id ?? null,
    })
    .eq('id', authData.user.id)

  if (profileError) {
    // Roll back the auth user so a failed profile update never leaves an
    // orphaned login with no matching, fully-set-up profile.
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json(
    {
      profile: {
        id: authData.user.id,
        full_name: input.full_name,
        email,
        phone: input.phone,
        role: 'staff',
        permissions: input.permissions ?? {},
      },
    },
    { status: 201 }
  )
}
