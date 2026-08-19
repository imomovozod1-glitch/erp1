import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'

const updateTenantSchema = z.object({
  subdomain: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  company_name: z.string().min(1).optional(),
  phone: z.string().min(7).optional(),
  status: z.enum(['active', 'blocked', 'inactive']).optional(),
  costing_method: z.enum(['fifo', 'lifo', 'aveco']).optional(),
  subscription_started_at: z.string().optional().nullable(),
  subscription_ends_at: z.string().optional().nullable(),
  price_paid: z.number().nullable().optional(),
  details: z.string().optional().nullable(),
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
    .select('id, phone, owner_user_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (input.subdomain !== undefined) update.subdomain = input.subdomain.toLowerCase()
  if (input.company_name !== undefined) update.company_name = input.company_name
  if (input.phone !== undefined) update.phone = input.phone
  if (input.status !== undefined) update.status = input.status
  if (input.costing_method !== undefined) update.costing_method = input.costing_method
  if (input.subscription_started_at !== undefined) update.subscription_started_at = input.subscription_started_at || null
  if (input.subscription_ends_at !== undefined) update.subscription_ends_at = input.subscription_ends_at || null
  if (input.price_paid !== undefined) update.price_paid = input.price_paid
  if (input.details !== undefined) update.details = input.details || null

  const { data: tenant, error } = await supabase.from('tenants').update(update).eq('id', id).select().single()
  if (error) {
    const message = error.code === '23505' ? 'Subdomain or phone already in use' : error.message
    return NextResponse.json({ error: message }, { status: 409 })
  }

  // Keep the owner's login in sync if the phone number (and therefore the
  // synthetic login email — see src/lib/tenant-auth.ts) changed.
  if (input.phone !== undefined && input.phone !== existing.phone && existing.owner_user_id) {
    await supabase.auth.admin.updateUserById(existing.owner_user_id, {
      email: phoneToSyntheticEmail(input.phone),
    })
  }

  return NextResponse.json({ tenant })
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
    .select('id, status, last_active_at, created_at, subscription_ends_at, owner_user_id')
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

  return NextResponse.json({ success: true })
}
