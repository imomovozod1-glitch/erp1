import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'

const updateProfileSchema = z.object({
  full_name: z.string().min(1),
})

/**
 * Super-admins live in a separate identity space from tenant `profiles` (see
 * src/lib/admin-auth.ts) with no `authenticated`-role RLS policy on
 * `super_admins` at all, so even updating your own row requires the
 * service-role key from a server route — the browser client can never write
 * to this table directly.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const { data: admin, error } = await supabase
    .from('super_admins')
    .update({ full_name: parsed.data.full_name })
    .eq('id', session.userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ admin })
}
