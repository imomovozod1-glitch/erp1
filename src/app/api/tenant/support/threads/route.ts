import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext, getCachedProfile } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { postMessage } from '@/lib/support-messaging'

const createSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(4000),
})

/** The tenant's own tickets, newest activity first, with an unread count. */
export async function GET() {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getCacheClient() as any
  const { data: threads } = await supabase
    .from('support_threads')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('kind', 'tenant')
    .order('last_message_at', { ascending: false })

  const list = threads ?? []
  const unreadByThread = new Map<string, number>()
  if (list.length > 0) {
    const { data: unread } = await supabase
      .from('support_messages')
      .select('thread_id')
      .in('thread_id', list.map((t: { id: string }) => t.id))
      .is('read_by_tenant_at', null)
    for (const row of (unread ?? []) as { thread_id: string }[]) {
      unreadByThread.set(row.thread_id, (unreadByThread.get(row.thread_id) ?? 0) + 1)
    }
  }

  return NextResponse.json({
    threads: list.map((t: { id: string }) => ({ ...t, unread: unreadByThread.get(t.id) ?? 0 })),
  })
}

/**
 * Opens a ticket. Goes through the server rather than the browser client so
 * the thread and its first message are written together, and so `agent_id` is
 * resolved from the tenant's current assignment instead of being supplied by
 * the caller.
 */
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'invalid_input' }, { status: 400 })
  }

  const supabase = getCacheClient() as any
  const [{ data: tenant }, profile] = await Promise.all([
    supabase.from('tenants').select('support_agent_id').eq('id', ctx.tenantId).maybeSingle(),
    getCachedProfile(ctx.userId) as Promise<{ full_name?: string } | null>,
  ])

  const { data: thread, error } = await supabase
    .from('support_threads')
    .insert({
      kind: 'tenant',
      tenant_id: ctx.tenantId,
      created_by: ctx.userId,
      agent_id: tenant?.support_agent_id ?? null,
      subject: parsed.data.subject,
      status: 'open',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const result = await postMessage({
    threadId: thread.id,
    tenantId: ctx.tenantId,
    senderRole: 'tenant',
    senderId: ctx.userId,
    senderName: profile?.full_name || 'User',
    body: parsed.data.body,
  })
  if (!result.ok) {
    // Don't leave an empty thread behind if the first message failed to land.
    await supabase.from('support_threads').delete().eq('id', thread.id)
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ id: thread.id }, { status: 201 })
}
