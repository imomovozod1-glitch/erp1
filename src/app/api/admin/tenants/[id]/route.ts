import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { phoneToSyntheticEmail, isReservedSubdomain } from '@/lib/tenant-auth'
import { phoneSchema } from '@/lib/phone-validation'
import { resolveTenantOwner } from '@/lib/tenant-owner'
import { registerTenantDomain, unregisterTenantDomain } from '@/lib/vercel-domains'

const updateTenantSchema = z.object({
  subdomain: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/)
    .refine((v) => !isReservedSubdomain(v), { message: 'This subdomain is reserved' })
    .optional(),
  company_name: z.string().min(1).optional(),
  phone: phoneSchema('Invalid phone number').optional(),
  // costing_method is deliberately absent: it is fixed when the tenant is
  // created (see supabase/migration_tenant_costing_lock.sql). zod drops the
  // key if a client still sends it.
  license_count: z.number().int().min(1).optional(),
  license_months: z.number().int().min(1).optional(),
  subscription_started_at: z.string().optional().nullable(),
  subscription_ends_at: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  support_agent_id: z.string().uuid().nullable().optional(),
})

const INACTIVITY_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000 // 180 days

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateTenantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const input = parsed.data

  const supabase = getCacheClient() as any

  const { data: existing } = await supabase
    .from('tenants')
    .select('id, phone, owner_user_id, subdomain')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  const phoneChanged = input.phone !== undefined && input.phone !== existing.phone

  const update: Record<string, unknown> = {}
  if (input.subdomain !== undefined) update.subdomain = input.subdomain.toLowerCase()
  const newSubdomain = update.subdomain as string | undefined
  const subdomainChanged = newSubdomain !== undefined && newSubdomain !== existing.subdomain
  if (input.company_name !== undefined) update.company_name = input.company_name
  if (input.phone !== undefined) update.phone = input.phone
  if (input.license_count !== undefined) update.license_count = input.license_count
  if (input.license_months !== undefined) update.license_months = input.license_months
  if (input.subscription_started_at !== undefined) update.subscription_started_at = input.subscription_started_at || null
  if (input.subscription_ends_at !== undefined) update.subscription_ends_at = input.subscription_ends_at || null
  if (input.details !== undefined) update.details = input.details || null
  if (input.support_agent_id !== undefined) update.support_agent_id = input.support_agent_id || null

  // Status is never set directly — it's purely date-derived (see
  // src/lib/tenant-status.ts). Editing the subscription term here can just
  // as well move it back into the future (a manual date correction), so
  // recompute it the same way a payment does rather than leaving a stale
  // 'blocked' behind.
  if (update.subscription_ends_at) {
    update.status = new Date(update.subscription_ends_at as string).getTime() >= Date.now() ? 'active' : 'blocked'
  }

  // The owner signs in with a login email derived from the phone. Move that
  // first: if it fails (e.g. another login already uses the new number), the
  // tenant keeps its old phone instead of showing one nobody can sign in with.
  if (phoneChanged) {
    // The account that signs in with the CURRENT phone (src/lib/tenant-owner.ts).
    const owner = await resolveTenantOwner(supabase, existing)
    const email = phoneToSyntheticEmail(input.phone!)
    const { error: authError } = owner
      ? await supabase.auth.admin.updateUserById(owner.userId, {
          email,
          email_confirm: true,
        })
      : { error: null }
    if (authError) {
      const message = /already.*registered|already exists|email_exists/i.test(authError.message)
        ? 'Another login already uses this phone number'
        : authError.message
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (owner) {
      await supabase.from('profiles').update({ phone: input.phone, email }).eq('id', owner.userId)
      if (owner.userId !== existing.owner_user_id) update.owner_user_id = owner.userId
    }
  }

  const { data: tenant, error } = await supabase.from('tenants').update(update).eq('id', id).select().single()
  if (error) {
    const message = error.code === '23505' ? 'Subdomain or phone already in use' : error.message
    return NextResponse.json({ error: message }, { status: 409 })
  }

  // Moving a tenant to another subdomain moves its host with it: the new one
  // is registered first, so a failure there leaves the company reachable at
  // the old address rather than at neither (src/lib/vercel-domains.ts).
  let domain
  if (subdomainChanged) {
    domain = await registerTenantDomain(newSubdomain!)
    if (domain.ok) await unregisterTenantDomain(existing.subdomain)
  }

  return NextResponse.json({ tenant, domain })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getCacheClient() as any

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, subdomain, status, last_active_at, created_at, subscription_ends_at, owner_user_id')
    .eq('id', id)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // Re-check server-side — never trust the client-disabled delete button.
  // Same dual rule as the UI (src/components/admin/delete-tenant-button.tsx):
  // 180 days since last actual use, OR — if blocked — 180 days since it
  // became blocked (subscription_ends_at).
  const inactivityElapsed = Date.now() - new Date(tenant.last_active_at ?? tenant.created_at).getTime()
  const blockedElapsed =
    tenant.status === 'blocked' && tenant.subscription_ends_at
      ? Date.now() - new Date(tenant.subscription_ends_at).getTime()
      : null
  const eligible = inactivityElapsed > INACTIVITY_THRESHOLD_MS || (blockedElapsed != null && blockedElapsed > INACTIVITY_THRESHOLD_MS)
  if (!eligible) {
    return NextResponse.json({ error: 'Tenant has been active within the last 180 days' }, { status: 403 })
  }

  const { error } = await supabase.from('tenants').delete().eq('id', id)
  if (error) {
    // FK constraints on every business table are intentionally NOT cascading —
    // a tenant with remaining business data (products, orders, etc.) fails
    // here instead of silently wiping a company's records.
    return NextResponse.json(
      { error: 'This tenant still has business data and cannot be deleted. Remove its data first.' },
      { status: 409 }
    )
  }

  if (tenant.owner_user_id) {
    await supabase.auth.admin.deleteUser(tenant.owner_user_id)
  }

  // Free the host again — the platform counts every registered domain against
  // the project, and a deleted company must not keep holding one.
  if (tenant.subdomain) await unregisterTenantDomain(tenant.subdomain)

  return NextResponse.json({ success: true })
}
