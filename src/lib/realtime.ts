import 'server-only'

/**
 * Server-side Supabase Realtime **broadcast**.
 *
 * Why broadcast and not `postgres_changes`: Realtime's postgres_changes mode
 * authorises each subscriber against RLS. Tenant users have RLS policies on
 * `support_messages` and could subscribe — but support agents and super-admins
 * deliberately have NO `authenticated` policies anywhere in this schema (see
 * migration_support_agents.sql), so their browsers cannot read those tables and
 * therefore cannot subscribe. Using postgres_changes would have given tenants
 * instant delivery and left staff on polling, which is worse than either.
 *
 * Broadcast doesn't touch table RLS at all: the server, which already
 * authorises every write, emits a small signal on a topic and both sides
 * refetch through their own authorised endpoint. The payload carries NO message
 * content — only "something changed on this thread" — so the channel itself
 * never becomes a way to read a conversation.
 *
 * Failures are swallowed on purpose: the clients still poll as a fallback, so a
 * Realtime outage degrades latency rather than losing messages.
 */

/** Topic for a single conversation's messages. */
export function threadTopic(threadId: string): string {
  return `support-thread:${threadId}`
}

/** Topic for a side's thread list (unread counts, ordering). */
export function inboxTopic(scope: 'tenant' | 'agent', id: string): string {
  return `support-inbox:${scope}:${id}`
}

export async function broadcast(topics: string[], event: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey || topics.length === 0) return

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: topics.map((topic) => ({
          topic,
          event,
          // Deliberately contentless — see the note above.
          payload: { at: new Date().toISOString() },
        })),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    // Polling covers this; never let a notification failure surface as a
    // failed send.
  }
}
