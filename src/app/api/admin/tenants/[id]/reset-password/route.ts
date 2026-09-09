import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { newPasswordSchema } from '@/lib/password-validation'

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
    .select('owner_user_id')
    .eq('id', id)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // `tenants.owner_user_id` is only filled in by the provisioning route
  // (/api/admin/tenants). Tenants that predate that column — or whose owner
  // row was created some other way — have it NULL, and this endpoint used to
  // give up with "Tenant has no owner login" even though the account plainly
  // exists. Fall back to the tenant's admin profile and backfill the link so
  // it resolves directly next time.
  let ownerId: string | null = tenant.owner_user_id ?? null
  if (!ownerId) {
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('tenant_id', id)
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    ownerId = adminProfile?.id ?? null
    if (ownerId) {
      await supabase.from('tenants').update({ owner_user_id: ownerId }).eq('id', id)
    }
  }

  if (!ownerId) {
    return NextResponse.json({ error: 'Tenant has no owner login' }, { status: 404 })
  }

  const { error } = await supabase.auth.admin.updateUserById(ownerId, {
    password: parsed.data.password,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Kick any currently-open session for this user immediately — see
  // supabase/migration_force_logout.sql and src/lib/supabase/middleware.ts.
  await supabase
    .from('profiles')
    .update({ force_logout_at: new Date().toISOString() })
    .eq('id', ownerId)

  return NextResponse.json({ success: true })
}
