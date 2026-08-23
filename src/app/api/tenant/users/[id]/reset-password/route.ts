import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { newPasswordSchema } from '@/lib/password-validation'

const schema = z.object({ password: newPasswordSchema('weak') })

/**
 * Lets a tenant admin reset a co-worker's password — the same-tenant
 * counterpart to `/api/admin/tenants/[id]/reset-password` (which only
 * covers a tenant's *owner* login and is vendor/super-admin-only). Tenant
 * users authenticate over the browser client, which has no access to
 * `auth.admin.*`, so this always has to go through a server route using the
 * service-role key — but that key must never act across tenants, hence the
 * explicit `tenant_id` match below rather than trusting the caller's role
 * claim from anywhere but their own DB-backed profile row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerProfile = await getCachedProfile(user.id) as any
  if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.tenant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: targetId } = await params
  if (targetId === user.id) {
    return NextResponse.json({ error: 'Use the Security tab to change your own password' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Password does not meet strength requirements' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const { data: target } = await supabase
    .from('profiles')
    .select('id, tenant_id')
    .eq('id', targetId)
    .maybeSingle()

  if (!target || target.tenant_id !== callerProfile.tenant_id) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { error } = await supabase.auth.admin.updateUserById(targetId, {
    password: parsed.data.password,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Kick any currently-open session for this user immediately — mirrors
  // the super-admin tenant-owner reset path (see supabase/migration_force_logout.sql).
  await supabase.from('profiles').update({ force_logout_at: new Date().toISOString() }).eq('id', targetId)

  return NextResponse.json({ success: true })
}
