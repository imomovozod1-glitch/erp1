import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { postMessage } from '@/lib/support-messaging'

const createSchema = z.object({
  agent_id: z.string().uuid(),
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(4000),
})

/**
 * Super-admin → support agent direct message. Creates a kind='agent' thread
 * (no tenant), which the agent sees in their portal alongside tenant tickets.
 */
export async function POST(request: NextRequest) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'invalid_input' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const { data: agent } = await supabase
    .from('support_agents')
    .select('id')
    .eq('id', parsed.data.agent_id)
    .maybeSingle()
  if (!agent) return NextResponse.json({ error: 'agent_not_found' }, { status: 404 })

  const { data: thread, error } = await supabase
    .from('support_threads')
    .insert({
      kind: 'agent',
      tenant_id: null,
      created_by: null,
      agent_id: parsed.data.agent_id,
      subject: parsed.data.subject,
      status: 'open',
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const result = await postMessage({
    threadId: thread.id,
    tenantId: null,
    senderRole: 'admin',
    senderId: session.userId,
    senderName: session.fullName,
    body: parsed.data.body,
  })
  if (!result.ok) {
    await supabase.from('support_threads').delete().eq('id', thread.id)
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ id: thread.id }, { status: 201 })
}
