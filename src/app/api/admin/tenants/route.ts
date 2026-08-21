import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { phoneToSyntheticEmail, isReservedSubdomain } from '@/lib/tenant-auth'

const createTenantSchema = z.object({
  subdomain: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/)
    .refine((v) => !isReservedSubdomain(v), { message: 'This subdomain is reserved' }),
  company_name: z.string().min(1),
  phone: z.string().min(7),
  password: z.string().min(6),
  costing_method: z.enum(['fifo', 'lifo', 'aveco']),
  license_count: z.number().int().min(1),
  license_months: z.number().int().min(1),
  subscription_started_at: z.string().optional().nullable(),
  subscription_ends_at: z.string().optional().nullable(),
  price_paid: z.number().nullable().optional(),
  details: z.string().optional().nullable(),
})

/**
 * Tenant provisioning — the only place a tenant account and its owner login
 * are created. Uses the service-role key (never exposed to the browser) for
 * both the `tenants` insert (RLS on that table grants `authenticated` no
 * INSERT policy at all) and `auth.admin.createUser` (admin-only API).
 */
export async function POST(request: NextRequest) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createTenantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const input = parsed.data

  const supabase = getCacheClient() as any

  // Status is never set manually here — it's always 'active' on creation
  // (the column default) and from then on purely date-derived from
  // subscription_ends_at, see src/lib/tenant-status.ts.
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      subdomain: input.subdomain.toLowerCase(),
      company_name: input.company_name,
      phone: input.phone,
      costing_method: input.costing_method,
      license_count: input.license_count,
      license_months: input.license_months,
      subscription_started_at: input.subscription_started_at || null,
      subscription_ends_at: input.subscription_ends_at || null,
      price_paid: input.price_paid ?? 0,
      details: input.details || null,
    })
    .select()
    .single()

  if (tenantError) {
    const message = tenantError.code === '23505' ? 'Subdomain or phone already in use' : tenantError.message
    return NextResponse.json({ error: message }, { status: 409 })
  }

  const email = phoneToSyntheticEmail(input.phone)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { tenant_id: tenant.id, full_name: input.company_name },
  })

  if (authError || !authData?.user) {
    // Roll back the tenant row so a failed provisioning attempt never leaves
    // an orphaned account with no owner login.
    await supabase.from('tenants').delete().eq('id', tenant.id)
    return NextResponse.json({ error: authError?.message || 'Failed to create login' }, { status: 400 })
  }

  // handle_new_user() inserts the profile with role='staff' and no phone —
  // the tenant's first user needs 'admin' so they can manage their own team,
  // and their real phone (not the synthetic login email) is what the profile
  // page should actually show.
  await supabase.from('profiles').update({ role: 'admin', phone: input.phone }).eq('id', authData.user.id)
  tenant.owner_user_id = authData.user.id
  await supabase.from('tenants').update({ owner_user_id: authData.user.id }).eq('id', tenant.id)

  if (input.price_paid && input.price_paid > 0) {
    await supabase.from('tenant_payments').insert({
      tenant_id: tenant.id,
      amount: input.price_paid,
      recorded_by: session.userId,
    })
  }

  return NextResponse.json({ tenant }, { status: 201 })
}
