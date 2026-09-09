import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupportAgentSession } from '@/lib/admin-auth'
import {
  agentCanAccessThread,
  getMessages,
  getThread,
  markThreadReadByStaff,
  postMessage,
} from '@/lib/support-messaging'

const bodySchema = z.object({ body: z.string().trim().min(1).max(4000) })

/** Read a thread. Opening it clears the agent-side unread badge. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSupportAgentSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // The access check only needs the thread row; the history and the read-marker
  // are then fetched concurrently rather than in sequence.
  const thread = await getThread(id)
  if (!thread) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!(await agentCanAccessThread(session.userId, thread))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const [messages] = await Promise.all([getMessages(id), markThreadReadByStaff(id)])
  return NextResponse.json({ thread, messages })
}

/** Agent replies. The tenant's unread badge is what notifies the asker. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSupportAgentSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  // Thread row only — authorising a reply never needed the message history.
  const thread = await getThread(id)
  if (!thread) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!(await agentCanAccessThread(session.userId, thread))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (thread.status === 'closed') {
    return NextResponse.json({ error: 'thread_closed' }, { status: 400 })
  }

  const result = await postMessage({
    threadId: id,
    tenantId: thread.tenant_id,
    senderRole: 'agent',
    senderId: session.userId,
    senderName: session.fullName,
    body: parsed.data.body,
    agentId: thread.agent_id ?? session.userId,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, message: result.message }, { status: 201 })
}
