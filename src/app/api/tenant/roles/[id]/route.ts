import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { invalidateProfile, invalidateRoleTemplates } from '@/lib/data/revalidate'
import { PERMISSION_MODULES } from '@/lib/permissions'

/**
 * Create/update/delete a role template, and keep the people already on that
 * role in sync.
 *
 * Two things this fixes over writing `role_templates` straight from the form:
 *
 *  1. Propagation. `profiles.permissions` is a COPY taken when the role was
 *     applied, and `profiles.role_template_id` only records where that copy
 *     came from. Editing a role therefore changed nothing for anyone already
 *     assigned to it — the admin saw "Sotuvchi" gain a module and reasonably
 *     assumed every Sotuvchi now had it, while every existing one kept the old
 *     copy indefinitely. The PATCH below re-applies the new permission set to
 *     every profile carrying this template.
 *
 *  2. Privilege. Role templates decide what users may see and do, so editing
 *     them is an admin operation — and since `profiles.permissions` is no
 *     longer writable by `authenticated`
 *     (migration_profile_privilege_lockdown.sql), the propagation step needs
 *     the service-role key regardless.
 */

const permissionsSchema = z.record(
  z.string(),
  z.object({ view: z.boolean(), edit: z.boolean() })
)

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  permissions: permissionsSchema,
})

/** Keep only known modules, and normalise "edit implies view". */
function normalise(permissions: Record<string, { view: boolean; edit: boolean }>) {
  const out: Record<string, { view: boolean; edit: boolean }> = {}
  for (const moduleKey of PERMISSION_MODULES) {
    const entry = permissions[moduleKey]
    if (entry) out[moduleKey] = { view: entry.view || entry.edit, edit: entry.edit }
  }
  return out
}

async function requireAdmin() {
  const ctx = await getTenantContext()
  if (!ctx) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (ctx.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
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
    return NextResponse.json({ error: updateError.message }, { status: 400 })
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
      return NextResponse.json({ error: propagateError.message }, { status: 400 })
    }
    await Promise.all(ids.map((profileId) => invalidateProfile(profileId)))
  }

  await invalidateRoleTemplates()
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
  if (unlinkError) return NextResponse.json({ error: unlinkError.message }, { status: 400 })

  const { error: deleteError } = await supabase
    .from('role_templates')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx!.tenantId)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

  await invalidateRoleTemplates()
  return NextResponse.json({ ok: true })
}
