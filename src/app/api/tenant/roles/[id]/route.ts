import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { expireProfile, expireRoleTemplates } from '@/lib/data/revalidate-route'
import { PERMISSION_MODULES, normaliseModulePermission } from '@/lib/permissions'

/**
 * Create/update/delete a role template, and keep the people already on that
 * role in sync — editing a role re-applies its new permission set to every
 * profile carrying it, since `profiles.permissions` is a copy taken when the
 * role was applied. Admin-only: role templates decide what their holders may
 * see and do.
 */

// Loose per-module object; `normalise` below pins the actual action set.
const permissionsSchema = z.record(z.string(), z.record(z.string(), z.unknown()))

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  permissions: permissionsSchema,
})

/** Keeps only known modules and normalises each module's action set. */
function normalise(permissions: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const moduleKey of PERMISSION_MODULES) {
    const entry = permissions[moduleKey]
    if (entry) out[moduleKey] = normaliseModulePermission(entry)
  }
  return out
}

async function requireAdmin() {
  const ctx = await getTenantContext()
  if (!ctx) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  if (ctx.role !== 'admin') return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  return { ctx }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const permissions = normalise(parsed.data.permissions)

  const supabase = getCacheClient() as any

  const { data: existing } = await supabase
    .from('role_templates')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', ctx!.tenantId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { error: updateError } = await supabase
    .from('role_templates')
    .update({ name: parsed.data.name, permissions })
    .eq('id', id)
    .eq('tenant_id', ctx!.tenantId)

  if (updateError) {
    // UNIQUE (tenant_id, name)
    if (updateError.code === '23505') {
      return NextResponse.json({ error: 'duplicate_name' }, { status: 409 })
    }
    console.error('[tenant/roles] update failed:', updateError.message)
    return NextResponse.json({ error: 'server_error' }, { status: 400 })
  }

  // Push the new permission set onto everyone currently on this role.
  const { data: assigned } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', ctx!.tenantId)
    .eq('role_template_id', id)

  const ids: string[] = (assigned ?? []).map((p: { id: string }) => p.id)
  if (ids.length > 0) {
    const { error: propagateError } = await supabase
      .from('profiles')
      .update({ permissions })
      .in('id', ids)
    if (propagateError) {
      console.error('[tenant/roles] permission propagation failed:', propagateError.message)
      return NextResponse.json({ error: 'server_error' }, { status: 400 })
    }
    ids.forEach((profileId) => expireProfile(profileId))
  }

  expireRoleTemplates()
  return NextResponse.json({ ok: true, updatedProfiles: ids.length })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const supabase = getCacheClient() as any

  // Profiles keep the permissions they were given; only the "which template
  // was this seeded from" pointer is cleared. Dropping their access because a
  // label was deleted would be a surprising amount of collateral damage.
  const { error: unlinkError } = await supabase
    .from('profiles')
    .update({ role_template_id: null })
    .eq('tenant_id', ctx!.tenantId)
    .eq('role_template_id', id)
  if (unlinkError) {
    console.error('[tenant/roles] unlink failed:', unlinkError.message)
    return NextResponse.json({ error: 'server_error' }, { status: 400 })
  }

  const { error: deleteError } = await supabase
    .from('role_templates')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx!.tenantId)
  if (deleteError) {
    console.error('[tenant/roles] delete failed:', deleteError.message)
    return NextResponse.json({ error: 'server_error' }, { status: 400 })
  }

  expireRoleTemplates()
  return NextResponse.json({ ok: true })
}
