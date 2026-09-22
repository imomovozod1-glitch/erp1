import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { phoneSchema } from '@/lib/phone-validation'
import { newPasswordSchema } from '@/lib/password-validation'

const updateSupportAgentSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: phoneSchema('Invalid phone number').optional(),
  // The edit form always sends this field and sends it EMPTY when the password
  // is being left alone (support-agent-form.tsx) — so an empty string has to be
  // accepted here and understood as "no change". It used to be missing from
  // this schema entirely, and zod strips what it does not declare: a new
  // password was dropped in silence, the console reported success, and the
  // agent was then locked out of a password that had never been set.
  password: z.union([newPasswordSchema('Password does not meet strength requirements'), z.literal('')]).optional(),
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

  // Everything that lives on the auth user rather than on the support_agents
  // row: the synthetic login email, which has to follow a changed phone number
  // (same as tenant owners — src/app/api/admin/tenants/[id]/route.ts), and the
  // password. One call, and its failure is reported: a silently ignored error
  // here reads as "saved" in the console and as "wrong password" at the portal.
  const authUpdate: { email?: string; password?: string } = {}
  if (input.phone !== undefined && input.phone !== existing.phone) {
    authUpdate.email = phoneToSyntheticEmail(input.phone)
  }
  if (input.password) {
    authUpdate.password = input.password
  }

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdate)
    if (authError) {
      return NextResponse.json({ error: authError.message || 'Failed to update the login' }, { status: 400 })
    }
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
  revalidateTag(`staff-identity:${id}`, { expire: 0 })

  return NextResponse.json({ success: true })
}
