import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { invalidateProfile } from '@/lib/data/revalidate'
import { PERMISSION_MODULES, normaliseModulePermission } from '@/lib/permissions'

/**
 * The only path by which a tenant user's role, module permissions or active
 * status can change.
 *
 * `authenticated` no longer holds UPDATE on those columns
 * (supabase/migration_profile_privilege_lockdown.sql), because a row-level
 * policy that lets a user edit their own profile also let them set
 * `role: 'admin'` on it. Those writes therefore have to happen with the
 * service-role key, behind the checks below:
 *
 *   - caller is an admin,
 *   - target is in the caller's own tenant,
 *   - nobody edits their own role or active flag (an admin cannot quietly
 *     demote themselves into a locked-out state, and — more importantly — a
 *     compromised admin session can't be used to hide the change on itself),
 *   - the tenant always keeps at least one active admin.
 */

// String-keyed rather than `z.record(z.enum(...))`: in Zod v4 an enum-keyed
// record demands every member be present, and the matrix only sends the
// modules that were actually touched. Unknown keys are dropped below.
// Loose object per module: the exact action set is normalised below, so adding
// an action later doesn't require a schema change in lockstep.
const permissionsSchema = z.record(z.string(), z.record(z.string(), z.unknown())).optional()

const bodySchema = z
  .object({
    role: z.enum(['admin', 'manager', 'staff']).optional(),
    is_active: z.boolean().optional(),
    permissions: permissionsSchema,
    role_template_id: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' })

function pickKnownModules(permissions: Record<string, unknown> | undefined) {
  if (!permissions) return undefined
  const known: Record<string, unknown> = {}
  for (const moduleKey of PERMISSION_MODULES) {
    const entry = permissions[moduleKey]
    // Normalised server-side too, so a hand-built payload can't store an
    // incoherent combination (e.g. "can delete but cannot view").
    if (entry) known[moduleKey] = normaliseModulePermission(entry)
  }
  return known
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: targetId } = await params
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const input = parsed.data

  const isSelf = targetId === ctx.userId
  if (isSelf && (input.role !== undefined || input.is_active !== undefined)) {
    return NextResponse.json({ error: 'cannot_change_own_access' }, { status: 400 })
  }

  const supabase = getCacheClient() as any

  const { data: target } = await supabase
    .from('profiles')
    .select('id, tenant_id, role, is_active')
    .eq('id', targetId)
    .maybeSingle()

  if (!target || target.tenant_id !== ctx.tenantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Removing the last active admin would leave the tenant with nobody able to
  // manage users — including nobody able to undo it.
  const losesAdmin =
    (input.role !== undefined && target.role === 'admin' && input.role !== 'admin') ||
    (input.is_active === false && target.role === 'admin')
  if (losesAdmin) {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId)
      .eq('role', 'admin')
      .eq('is_active', true)
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'last_admin' }, { status: 400 })
    }
  }

  if (input.role_template_id) {
    // role_templates.id is a plain FK with no tenant constraint, so an id from
    // another tenant would otherwise be accepted and stored.
    const { data: template } = await supabase
      .from('role_templates')
      .select('id')
      .eq('id', input.role_template_id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle()
    if (!template) return NextResponse.json({ error: 'invalid_role_template' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (input.role !== undefined) update.role = input.role
  if (input.is_active !== undefined) update.is_active = input.is_active
  if (input.permissions !== undefined) update.permissions = pickKnownModules(input.permissions) ?? {}
  if (input.role_template_id !== undefined) update.role_template_id = input.role_template_id

  const { error } = await supabase.from('profiles').update(update).eq('id', targetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await invalidateProfile(targetId)
  return NextResponse.json({ ok: true })
}
