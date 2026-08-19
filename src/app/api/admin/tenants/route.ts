import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'

const createTenantSchema = z.object({
  subdomain: z.string().min(2).regex(/^[a-z0-9-]+$/),
  company_name: z.string().min(1),
  phone: z.string().min(7),
  password: z.string().min(6),
  status: z.enum(['active', 'blocked', 'inactive']),
  costing_method: z.enum(['fifo', 'lifo', 'aveco']),
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

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      subdomain: input.subdomain.toLowerCase(),
      company_name: input.company_name,
      phone: input.phone,
      status: input.status,
      costing_method: input.costing_method,
      subscription_started_at: input.subscription_started_at || null,
      subscription_ends_at: input.subscription_ends_at || null,
      price_paid: input.price_paid ?? null,
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

  // handle_new_user() inserts the profile with role='staff' by default —
  // the tenant's first user needs 'admin' so they can manage their own team.
  await supabase.from('profiles').update({ role: 'admin' }).eq('id', authData.user.id)
  await supabase.from('tenants').update({ owner_user_id: authData.user.id }).eq('id', tenant.id)

  return NextResponse.json({ tenant }, { status: 201 })
}
