import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'

const schema = z.object({ password: z.string().min(6) })

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
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const { data: tenant } = await supabase.from('tenants').select('owner_user_id').eq('id', id).maybeSingle()
  if (!tenant?.owner_user_id) {
    return NextResponse.json({ error: 'Tenant has no owner login' }, { status: 404 })
  }

  const { error } = await supabase.auth.admin.updateUserById(tenant.owner_user_id, {
    password: parsed.data.password,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Kick any currently-open session for this user immediately — see
  // supabase/migration_force_logout.sql and src/lib/supabase/middleware.ts.
  await supabase
    .from('profiles')
    .update({ force_logout_at: new Date().toISOString() })
    .eq('id', tenant.owner_user_id)

  return NextResponse.json({ success: true })
}
