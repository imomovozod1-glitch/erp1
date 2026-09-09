'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, MessageSquare, Send, ShieldCheck, Building2, Headset } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type SenderRole = 'tenant' | 'agent' | 'admin'

interface ThreadSummary {
  id: string
  kind: 'tenant' | 'agent'
  subject: string
  status: 'open' | 'answered' | 'closed'
  last_message_at: string
  unread: number
  tenant_name?: string | null
}

interface Message {
  id: string
  sender_role: SenderRole
  sender_name: string
  body: string
  created_at: string
  /** Local-only: shown dimmed until the server confirms the write. */
  pending?: boolean
}

const STATUS_TONE: Record<ThreadSummary['status'], StatusTone> = {
  open: 'amber',
  answered: 'emerald',
  closed: 'slate',
}

const ROLE_ICON: Record<SenderRole, typeof ShieldCheck> = {
  admin: ShieldCheck,
  agent: Headset,
  tenant: Building2,
}

interface SupportConversationProps {
  /** Collection endpoint; a thread is `${endpoint}/${id}/messages`. */
  endpoint: string
  /** Which side is reading — decides which bubbles are "mine". */
  viewer: 'agent' | 'tenant'
  /** Show the tenant/company name on each thread (agent portal only). */
  showTenantName?: boolean
  /** Refresh signal from the parent after a new thread is created. */
  refreshKey?: number
  /**
   * Realtime inbox topic for this side — `support-inbox:tenant:<tenantId>` or
   * `support-inbox:agent:<agentId>`. When given, new messages arrive as a push
   * instead of waiting for the poll interval.
   */
  inboxTopic?: string
  className?: string
}

/**
 * The shared thread list + chat panel, used by both the tenant Support page
 * and the support-agent portal. The two sides talk to different endpoints
 * (`/api/tenant/support/threads` vs `/api/support/threads`) but the
 * conversation itself behaves identically, so it lives in one component
 * rather than being written twice and drifting.
 *
 * Opening a thread marks it read for the current side, which is what clears
 * the unread badge that notifies the other party's reply.
 */
export function SupportConversation({
  endpoint,
  viewer,
  showTenantName = false,
  refreshKey = 0,
  inboxTopic,
  className,
}: SupportConversationProps) {
  const t = useTranslations('supportChat')
  const tCommon = useTranslations('common')

  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  /** Ids for optimistic bubbles. A counter, not Math.random/Date.now — those
   *  are impure during render under the React Compiler lint rules. */
  const pendingCounter = useRef(0)

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      setThreads(json.threads ?? [])
      return json.threads as ThreadSummary[]
    } catch {
      return []
    } finally {
      setIsLoadingThreads(false)
    }
  }, [endpoint])

  const loadMessages = useCallback(
    async (threadId: string, showSpinner = true) => {
      if (showSpinner) setIsLoadingMessages(true)
      try {
        const res = await fetch(`${endpoint}/${threadId}/messages`)
        if (!res.ok) throw new Error('failed')
        const json = await res.json()
        setMessages(json.messages ?? [])
      } catch {
        toast.error(tCommon('error'))
      } finally {
        setIsLoadingMessages(false)
      }
    },
    [endpoint, tCommon]
  )

  // Deferred with a 0ms timer rather than called straight from the effect
  // body: both loaders flip a loading flag synchronously, and the React
  // Compiler treats setState during an effect as a cascading render
  // (react-hooks/set-state-in-effect). Same shape already used by
  // settings/company-form.tsx.
  useEffect(() => {
    const timer = setTimeout(() => { loadThreads() }, 0)
    return () => clearTimeout(timer)
  }, [loadThreads, refreshKey])

  useEffect(() => {
    if (!activeId) return
    const timer = setTimeout(() => { loadMessages(activeId) }, 0)
    return () => clearTimeout(timer)
  }, [activeId, loadMessages])

  /**
   * Realtime delivery. The server broadcasts a contentless "something changed"
   * signal on the thread's topic and on each side's inbox topic after every
   * write (src/lib/realtime.ts); we refetch through the normal authorised
   * endpoint when one arrives, so nothing sensitive travels over the channel.
   *
   * Broadcast rather than postgres_changes because support agents have no RLS
   * policies on these tables and so cannot subscribe to row changes at all —
   * see the note in src/lib/realtime.ts.
   */
  useEffect(() => {
    const supabase = createClient()
    const channels: ReturnType<typeof supabase.channel>[] = []

    // Inbox topic → the thread list changed (new ticket, unread count, order).
    if (inboxTopic) {
      const channel = supabase.channel(inboxTopic)
      channel.on('broadcast', { event: 'support_message' }, () => { loadThreads() }).subscribe()
      channels.push(channel)
    }
    // Thread topic → only this conversation changed. Refetching the thread list
    // as well (as this used to) doubled the requests for every single message.
    if (activeId) {
      const channel = supabase.channel(`support-thread:${activeId}`)
      channel
        .on('broadcast', { event: 'support_message' }, () => { loadMessages(activeId, false) })
        .subscribe()
      channels.push(channel)
    }

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel))
    }
  }, [activeId, inboxTopic, loadThreads, loadMessages])

  // Polling stays as a fallback, at a slower cadence now that realtime carries
  // the fast path: it covers a dropped socket or Realtime being unavailable,
  // where losing a reply entirely would be far worse than a late one.
  useEffect(() => {
    const id = setInterval(() => {
      loadThreads()
      if (activeId) loadMessages(activeId, false)
    }, 60000)
    return () => clearInterval(id)
  }, [activeId, loadThreads, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  /**
   * Sending is optimistic: the bubble appears the moment Enter is pressed and
   * the textarea clears, then the server's row replaces the placeholder when
   * the POST returns. Previously the input stayed frozen through a POST plus a
   * full re-read of the conversation *and* the thread list — three round trips
   * before a typed message showed up at all, which is what made it feel like
   * the chat had hung.
   */
  const handleSend = async () => {
    const body = reply.trim()
    if (!body || !activeId || isSending) return

    const tempId = `pending-${pendingCounter.current++}`
    const optimistic: Message = {
      id: tempId,
      sender_role: viewer,
      sender_name: '',
      body,
      created_at: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setReply('')
    setIsSending(true)

    try {
      const res = await fetch(`${endpoint}/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error === 'thread_closed' ? t('threadClosed') : tCommon('error'))
      }
      // Swap the placeholder for the stored row (real id and timestamp), or
      // just drop the pending flag if this server can't return the row.
      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempId
            ? json.message
              ? { ...(json.message as Message), pending: false }
              : { ...message, pending: false }
            : message
        )
      )
      // The list only needs its ordering/preview refreshed, and nobody is
      // waiting on it.
      loadThreads()
    } catch (error: any) {
      // Put the text back in the box rather than losing what was typed.
      setMessages((prev) => prev.filter((message) => message.id !== tempId))
      setReply(body)
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSending(false)
    }
  }

  const activeThread = threads.find((th) => th.id === activeId) ?? null

  return (
    <div className={cn('grid gap-4 lg:grid-cols-[320px_1fr]', className)}>
      {/* Thread list */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0 max-h-[560px] overflow-y-auto">
          {isLoadingThreads ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p className="text-sm">{t('noThreads')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(thread.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors hover:bg-violet-50/60 dark:hover:bg-violet-950/20',
                      activeId === thread.id && 'bg-violet-50 dark:bg-violet-950/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-200 line-clamp-1">
                        {thread.subject}
                      </span>
                      {thread.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                          {thread.unread}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <StatusBadge tone={STATUS_TONE[thread.status]} label={t(`status_${thread.status}`)} />
                      {thread.kind === 'agent' && (
                        <StatusBadge tone="indigo" label={t('fromAdmin')} />
                      )}
                      {showTenantName && thread.tenant_name && (
                        <span className="text-[11px] text-muted-foreground">{thread.tenant_name}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(thread.last_message_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Conversation */}
      <Card className="border-0 shadow-sm flex flex-col min-h-[560px]">
        {!activeThread ? (
          <CardContent className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">{t('selectThread')}</p>
          </CardContent>
        ) : (
          <>
            <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">{activeThread.subject}</h3>
              {showTenantName && activeThread.tenant_name && (
                <p className="text-xs text-muted-foreground">{activeThread.tenant_name}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-[400px]">
              {isLoadingMessages ? (
                <div className="flex justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                messages.map((message) => {
                  // "Mine" is role-based, so an agent sees admin messages and
                  // tenant messages both as incoming, on opposite sides of the
                  // conversation from their own replies.
                  const isMine =
                    viewer === 'agent' ? message.sender_role === 'agent' : message.sender_role === 'tenant'
                  const Icon = ROLE_ICON[message.sender_role]
                  return (
                    <div
                      key={message.id}
                      className={cn('flex gap-2', isMine ? 'justify-end' : 'justify-start')}
                    >
                      {!isMine && (
                        <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm transition-opacity',
                          message.pending && 'opacity-60',
                          isMine
                            ? 'bg-violet-600 text-white rounded-br-sm'
                            : message.sender_role === 'admin'
                              ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 rounded-bl-sm'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-bl-sm'
                        )}
                      >
                        {!isMine && (
                          <p className="text-[11px] font-semibold opacity-80 mb-0.5">
                            {message.sender_name}
                            {message.sender_role === 'admin' && ` · ${t('fromAdmin')}`}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap wrap-break-word">{message.body}</p>
                        <p className={cn('text-[10px] mt-1', isMine ? 'text-white/70' : 'text-muted-foreground')}>
                          {formatDateTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 p-3">
              {activeThread.status === 'closed' ? (
                <p className="text-center text-xs text-muted-foreground py-2">{t('threadClosed')}</p>
              ) : (
                <div className="flex items-end gap-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={t('replyPlaceholder')}
                    rows={2}
                    className="resize-none"
                    onKeyDown={(e) => {
                      // Enter sends, Shift+Enter makes a new line — the
                      // convention people already expect from a chat box.
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                  />
                  <Button onClick={handleSend} disabled={isSending || !reply.trim()} size="icon-lg">
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
