import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { phoneSchema } from '@/lib/phone-validation'

const updateSupportAgentSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: phoneSchema('Invalid phone number').optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateSupportAgentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const input = parsed.data

  const supabase = getCacheClient() as any

  const { data: existing } = await supabase
    .from('support_agents')
    .select('id, phone')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Support agent not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (input.full_name !== undefined) update.full_name = input.full_name
  if (input.phone !== undefined) update.phone = input.phone

  const { data: agent, error } = await supabase.from('support_agents').update(update).eq('id', id).select().single()
  if (error) {
    const message = error.code === '23505' ? 'Phone already in use' : error.message
    return NextResponse.json({ error: message }, { status: 409 })
  }

  // Keep the agent's login in sync with a changed phone number, same as
  // tenant owners (see src/app/api/admin/tenants/[id]/route.ts).
  if (input.phone !== undefined && input.phone !== existing.phone) {
    await supabase.auth.admin.updateUserById(id, { email: phoneToSyntheticEmail(input.phone) })
  }

  return NextResponse.json({ agent })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getCacheClient() as any

  const { data: agent } = await supabase.from('support_agents').select('id').eq('id', id).maybeSingle()
  if (!agent) return NextResponse.json({ error: 'Support agent not found' }, { status: 404 })

  // tenants.support_agent_id is ON DELETE SET NULL — deleting an agent just
  // unassigns them from whatever tenants they had, it never blocks on it.
  const { error } = await supabase.from('support_agents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })

  await supabase.auth.admin.deleteUser(id)

  return NextResponse.json({ success: true })
}
