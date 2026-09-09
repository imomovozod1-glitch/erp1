import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext, getCachedProfile } from '@/lib/auth'
import {
  getMessages,
  getThread,
  markThreadReadByTenant,
  postMessage,
} from '@/lib/support-messaging'

const bodySchema = z.object({ body: z.string().trim().min(1).max(4000) })

/** Read a thread. Opening it clears this tenant's unread badge for it. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Ownership is decided on the thread row alone; the messages and the
  // read-marker then run concurrently instead of one after the other.
  const thread = await getThread(id)
  if (!thread || thread.tenant_id !== ctx.tenantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const [messages] = await Promise.all([getMessages(id), markThreadReadByTenant(id)])
  return NextResponse.json({ thread, messages })
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

  // Only the thread row is needed to authorise a write; the previous version
  // loaded every message in the conversation first, on every single send.
  const [thread, profile] = await Promise.all([
    getThread(id),
    getCachedProfile(ctx.userId) as Promise<{ full_name?: string } | null>,
  ])
  if (!thread || thread.tenant_id !== ctx.tenantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (thread.status === 'closed') {
    return NextResponse.json({ error: 'thread_closed' }, { status: 400 })
  }

  const result = await postMessage({
    threadId: id,
    tenantId: ctx.tenantId,
    senderRole: 'tenant',
    senderId: ctx.userId,
    senderName: profile?.full_name || 'User',
    body: parsed.data.body,
    agentId: thread.agent_id,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  // The row goes back with the response so the sender can render it without a
  // second round trip.
  return NextResponse.json({ ok: true, message: result.message }, { status: 201 })
}
