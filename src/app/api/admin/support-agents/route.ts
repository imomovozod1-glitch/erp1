import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { phoneToSyntheticEmail } from '@/lib/tenant-auth'
import { phoneSchema } from '@/lib/phone-validation'
import { newPasswordSchema } from '@/lib/password-validation'

const createSupportAgentSchema = z.object({
  full_name: z.string().min(1),
  phone: phoneSchema('Invalid phone number'),
  password: newPasswordSchema('Password does not meet strength requirements'),
})

/**
 * Support-agent provisioning — the super-admin console's counterpart to
 * /api/admin/tenants, reusing the exact same mechanism (synthetic-email +
 * auth.admin.createUser via the service-role key) but writing to
 * support_agents instead of tenants. Deliberately NOT a tenant row — see
 * migration_support_agents.sql for why.
 */
export async function POST(request: NextRequest) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createSupportAgentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const input = parsed.data

  const supabase = getCacheClient() as any
  const email = phoneToSyntheticEmail(input.phone)

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    // No tenant_id in metadata — handle_new_user() will insert a stray
    // profiles row with tenant_id NULL, same as it does for super_admins;
    // isSupportAgent()/isSuperAdmin() keep those stray profiles from ever
    // being treated as a real tenant session (see src/lib/admin-auth.ts).
    user_metadata: { full_name: input.full_name },
  })

  if (authError || !authData?.user) {
    const message = authError?.message?.includes('already registered')
      ? 'This phone number is already in use'
      : authError?.message || 'Failed to create login'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { data: agent, error: agentError } = await supabase
    .from('support_agents')
    .insert({ id: authData.user.id, full_name: input.full_name, phone: input.phone })
    .select()
    .single()

  if (agentError) {
    // Roll back the auth user so a failed insert never leaves an orphaned
    // login with no matching support_agents row.
    await supabase.auth.admin.deleteUser(authData.user.id)
    const message = agentError.code === '23505' ? 'Phone already in use' : agentError.message
    return NextResponse.json({ error: message }, { status: 409 })
  }

  return NextResponse.json({ agent }, { status: 201 })
}

export async function GET() {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('support_agents')
    .select('id, full_name, phone, created_at, tenants(id, company_name, subdomain)')
    .order('created_at', { ascending: false })

  return NextResponse.json({ agents: data ?? [] })
}
