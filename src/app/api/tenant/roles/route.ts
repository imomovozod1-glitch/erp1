import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { expireRoleTemplates } from '@/lib/data/revalidate-route'
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
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
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
    console.error('[tenant/roles] insert failed:', error.message)
    return NextResponse.json({ error: 'server_error' }, { status: 400 })
  }

  expireRoleTemplates()
  return NextResponse.json({ id: data.id }, { status: 201 })
}
