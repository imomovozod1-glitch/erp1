import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { adminServerError } from '@/lib/admin-errors-server'

const updateLeadSchema = z.object({ status: z.enum(['new', 'contacted', 'closed']) })

/** Moves a landing-page sign-up request through new → contacted → closed. Super-admin only. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = updateLeadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const { error } = await supabase.from('leads').update({ status: parsed.data.status }).eq('id', id)
  if (error) return adminServerError(error)
  return NextResponse.json({ ok: true })
}
