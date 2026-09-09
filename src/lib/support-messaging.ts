import 'server-only'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { broadcast, inboxTopic, threadTopic } from '@/lib/realtime'

/**
 * Shared helpers for the support conversation model
 * (supabase/migration_support_messaging.sql).
 *
 * Everything here runs with the service-role client because the agent and
 * admin sides have no `authenticated` RLS policies at all — that is the
 * established access model for `support_agents`/`super_admins` in this
 * codebase, not a shortcut taken here.
 */

export type ThreadKind = 'tenant' | 'agent'
export type SenderRole = 'tenant' | 'agent' | 'admin'
export type ThreadStatus = 'open' | 'answered' | 'closed'

export interface SupportMessage {
  id: string
  thread_id: string
  sender_role: SenderRole
  sender_name: string
  body: string
  created_at: string
  read_by_tenant_at: string | null
  read_by_staff_at: string | null
}

export interface SupportThread {
  id: string
  kind: ThreadKind
  tenant_id: string | null
  created_by: string | null
  agent_id: string | null
  subject: string
  status: ThreadStatus
  last_message_at: string
  created_at: string
}

/**
 * Appends a message and moves the thread's status.
 *
 * A tenant message reopens the thread (they replied, so it needs attention
 * again); a staff message marks it answered. The message is stamped as already
 * read by whichever side wrote it, so nobody sees an unread badge for their own
 * text.
 */
export async function postMessage(input: {
  threadId: string
  tenantId: string | null
  senderRole: SenderRole
  senderId: string | null
  senderName: string
  body: string
  /** Already-known routing for the broadcast, so this doesn't re-read the thread. */
  agentId?: string | null
}): Promise<{ ok: true; message: SupportMessage } | { ok: false; error: string }> {
  const supabase = getCacheClient() as any
  const now = new Date().toISOString()
  const fromTenant = input.senderRole === 'tenant'

  // `.select().single()` so the caller can hand the row straight back to the
  // browser: the sender used to get only `{ ok: true }` and had to refetch the
  // whole conversation before its own message appeared, which is most of what
  // made sending feel slow.
  const { data: message, error: messageError } = await supabase
    .from('support_messages')
    .insert({
      thread_id: input.threadId,
      tenant_id: input.tenantId,
      sender_role: input.senderRole,
      sender_id: input.senderId,
      sender_name: input.senderName,
      body: input.body,
      read_by_tenant_at: fromTenant ? now : null,
      read_by_staff_at: fromTenant ? null : now,
    })
    .select('*')
    .single()
  if (messageError) return { ok: false, error: messageError.message }

  // The thread bump and the realtime signal do not gate the response: the
  // message is committed, and neither the sender nor the reader needs them to
  // have finished before the reply is drawn.
  const bump = supabase
    .from('support_threads')
    .update({ last_message_at: now, status: fromTenant ? 'open' : 'answered' })
    .eq('id', input.threadId)

  const topics = [threadTopic(input.threadId)]
  if (input.tenantId) topics.push(inboxTopic('tenant', input.tenantId))
  if (input.agentId) topics.push(inboxTopic('agent', input.agentId))

  await Promise.all([bump, broadcast(topics, 'support_message')])

  return { ok: true, message: message as SupportMessage }
}

/**
 * Just the thread row. Used by the write paths, which only need to know who
 * owns the thread and whether it is closed — loading the entire message
 * history to answer that (as the POST routes used to) is pure latency.
 */
export async function getThread(threadId: string): Promise<SupportThread | null> {
  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('support_threads')
    .select('id, kind, tenant_id, created_by, agent_id, subject, status, last_message_at, created_at')
    .eq('id', threadId)
    .maybeSingle()
  return (data as SupportThread) ?? null
}

/** A thread's messages, oldest first. */
export async function getMessages(threadId: string): Promise<SupportMessage[]> {
  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('support_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  return (data ?? []) as SupportMessage[]
}

/** Marks every message in a thread as seen by the tenant. */
export async function markThreadReadByTenant(threadId: string): Promise<void> {
  const supabase = getCacheClient() as any
  await supabase
    .from('support_messages')
    .update({ read_by_tenant_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .is('read_by_tenant_at', null)
}

/**
 * Every thread an agent should see: tickets from the tenants assigned to them,
 * plus direct messages addressed to them by a super-admin.
 *
 * Tenant tickets are matched by the tenant's CURRENT `support_agent_id` rather
 * than the thread's own `agent_id` snapshot — otherwise reassigning a tenant to
 * a different agent would strand its open tickets with the previous one.
 */
export async function getAgentThreads(agentId: string) {
  const supabase = getCacheClient() as any

  const { data: assignedTenants } = await supabase
    .from('tenants')
    .select('id, company_name')
    .eq('support_agent_id', agentId)

  const tenantIds: string[] = (assignedTenants ?? []).map((t: { id: string }) => t.id)
  const tenantNames = new Map<string, string>(
    (assignedTenants ?? []).map((t: { id: string; company_name: string }) => [t.id, t.company_name])
  )

  const [tenantThreadsRes, agentThreadsRes] = await Promise.all([
    tenantIds.length
      ? supabase
          .from('support_threads')
          .select('*')
          .eq('kind', 'tenant')
          .in('tenant_id', tenantIds)
          .order('last_message_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('support_threads')
      .select('*')
      .eq('kind', 'agent')
      .eq('agent_id', agentId)
      .order('last_message_at', { ascending: false }),
  ])

  const threads = [...(tenantThreadsRes.data ?? []), ...(agentThreadsRes.data ?? [])] as SupportThread[]
  threads.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())

  // One grouped query rather than a count per thread.
  const unreadByThread = new Map<string, number>()
  if (threads.length > 0) {
    const { data: unread } = await supabase
      .from('support_messages')
      .select('thread_id')
      .in('thread_id', threads.map((t) => t.id))
      .is('read_by_staff_at', null)
    for (const row of (unread ?? []) as { thread_id: string }[]) {
      unreadByThread.set(row.thread_id, (unreadByThread.get(row.thread_id) ?? 0) + 1)
    }
  }

  return threads.map((t) => ({
    ...t,
    tenant_name: t.tenant_id ? tenantNames.get(t.tenant_id) ?? null : null,
    unread: unreadByThread.get(t.id) ?? 0,
  }))
}

/**
 * True when this agent is allowed to act on this thread: it is addressed to
 * them, or it belongs to a tenant currently assigned to them.
 */
export async function agentCanAccessThread(agentId: string, thread: SupportThread): Promise<boolean> {
  if (thread.kind === 'agent') return thread.agent_id === agentId
  if (!thread.tenant_id) return false
  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', thread.tenant_id)
    .eq('support_agent_id', agentId)
    .maybeSingle()
  return !!data
}

/** Marks every message in a thread as seen by staff. */
export async function markThreadReadByStaff(threadId: string): Promise<void> {
  const supabase = getCacheClient() as any
  await supabase
    .from('support_messages')
    .update({ read_by_staff_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .is('read_by_staff_at', null)
}
