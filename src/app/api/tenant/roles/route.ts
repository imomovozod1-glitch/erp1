import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { invalidateRoleTemplates } from '@/lib/data/revalidate'
import { PERMISSION_MODULES, normaliseModulePermission } from '@/lib/permissions'

/**
 * Create a role template. Admin-only for the same reason as the PATCH in
 * `[id]/route.ts`: a role template decides what its holders may see and do.
 */

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  permissions: z.record(z.string(), z.record(z.string(), z.unknown())),
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

export async function POST(request: NextRequest) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const { data, error } = await supabase
    .from('role_templates')
    .insert({
      tenant_id: ctx.tenantId,
      name: parsed.data.name,
      permissions: normalise(parsed.data.permissions),
    })
    .select('id')
    .single()

  if (error) {
    // UNIQUE (tenant_id, name) — surfaced as a field error rather than a raw
    // Postgres string, since duplicating a role name is an easy mistake.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'duplicate_name' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await invalidateRoleTemplates()
  return NextResponse.json({ id: data.id }, { status: 201 })
}
