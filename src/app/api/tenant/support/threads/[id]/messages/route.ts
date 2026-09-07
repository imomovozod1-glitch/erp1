import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext, getCachedProfile } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { getThreadWithMessages, postMessage } from '@/lib/support-messaging'

const bodySchema = z.object({ body: z.string().trim().min(1).max(4000) })

async function loadOwnThread(threadId: string, tenantId: string) {
  const { thread, messages } = await getThreadWithMessages(threadId)
  if (!thread || thread.tenant_id !== tenantId) return null
  return { thread, messages }
}

/** Read a thread. Opening it clears this tenant's unread badge for it. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const found = await loadOwnThread(id, ctx.tenantId)
  if (!found) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const supabase = getCacheClient() as any
  await supabase
    .from('support_messages')
    .update({ read_by_tenant_at: new Date().toISOString() })
    .eq('thread_id', id)
    .is('read_by_tenant_at', null)

  return NextResponse.json(found)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const found = await loadOwnThread(id, ctx.tenantId)
  if (!found) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (found.thread.status === 'closed') {
    return NextResponse.json({ error: 'thread_closed' }, { status: 400 })
  }

  const profile = (await getCachedProfile(ctx.userId)) as { full_name?: string } | null
  const result = await postMessage({
    threadId: id,
    tenantId: ctx.tenantId,
    senderRole: 'tenant',
    senderId: ctx.userId,
    senderName: profile?.full_name || 'User',
    body: parsed.data.body,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
