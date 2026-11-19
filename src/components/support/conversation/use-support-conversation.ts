'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import type { Message, ThreadSummary, Viewer } from './conversation-types'

const POLL_MS = 60_000
const EVENT = 'support_message'

interface Options {
  endpoint: string
  viewer: Viewer
  refreshKey: number
  inboxTopic?: string
}

function useThreadData(endpoint: string) {
  const t = useTranslations('common')
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch(endpoint)
      if (res.ok) setThreads((await res.json()).threads ?? [])
    } catch {
      // A missed refresh is retried by the poll; the list keeps what it had.
    } finally {
      setLoadingThreads(false)
    }
  }, [endpoint])

  const loadMessages = useCallback(
    async (threadId: string, spinner = true) => {
      if (spinner) setLoadingMessages(true)
      try {
        const res = await fetch(`${endpoint}/${threadId}/messages`)
        if (!res.ok) throw new Error('failed')
        setMessages((await res.json()).messages ?? [])
      } catch {
        toast.error(t('error'))
      } finally {
        setLoadingMessages(false)
      }
    },
    [endpoint, t]
  )

  return { threads, messages, setMessages, loadingThreads, loadingMessages, loadThreads, loadMessages }
}

/**
 * Realtime is a contentless "something changed" broadcast on the inbox and thread topics
 * (agents have no RLS on these tables, so they cannot subscribe to row changes); the data
 * is refetched through the authorised endpoint. A slow poll covers a dropped socket.
 */
function useLiveUpdates(inboxTopic: string | undefined, activeId: string | null, loadThreads: () => void, loadMessages: (id: string, spinner: boolean) => void) {
  useEffect(() => {
    const supabase = createClient()
    const channels = [
      inboxTopic && supabase.channel(inboxTopic).on('broadcast', { event: EVENT }, () => loadThreads()),
      activeId && supabase.channel(`support-thread:${activeId}`).on('broadcast', { event: EVENT }, () => loadMessages(activeId, false)),
    ].filter((channel): channel is ReturnType<typeof supabase.channel> => !!channel)
    channels.forEach((channel) => channel.subscribe())
    return () => channels.forEach((channel) => void supabase.removeChannel(channel))
  }, [activeId, inboxTopic, loadThreads, loadMessages])

  useEffect(() => {
    const id = setInterval(() => {
      loadThreads()
      if (activeId) loadMessages(activeId, false)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [activeId, loadThreads, loadMessages])
}

export function useSupportConversation({ endpoint, viewer, refreshKey, inboxTopic }: Options) {
  const t = useTranslations()
  const data = useThreadData(endpoint)
  const { loadThreads, loadMessages, setMessages } = data
  const [activeId, setActiveId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  // Ids for optimistic bubbles: a counter, since Math.random/Date.now are impure in render.
  const pendingCounter = useRef(0)

  // Deferred a tick: the loaders flip a loading flag, which must not happen synchronously in an effect.
  useEffect(() => {
    const timer = setTimeout(() => void loadThreads(), 0)
    return () => clearTimeout(timer)
  }, [loadThreads, refreshKey])

  useEffect(() => {
    if (!activeId) return
    const timer = setTimeout(() => void loadMessages(activeId), 0)
    return () => clearTimeout(timer)
  }, [activeId, loadMessages])

  useLiveUpdates(inboxTopic, activeId, loadThreads, loadMessages)

  // Optimistic: the bubble shows on Enter and the box clears; the stored row replaces it on return.
  const send = async () => {
    const body = reply.trim()
    if (!body || !activeId || sending) return
    const tempId = `pending-${pendingCounter.current++}`
    setMessages((current) => [...current, { id: tempId, sender_role: viewer, sender_name: '', body, created_at: new Date().toISOString(), pending: true }])
    setReply('')
    setSending(true)
    try {
      const res = await fetch(`${endpoint}/${activeId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '')
      setMessages((current) => current.map((m) => (m.id === tempId ? { ...(json.message ?? m), pending: false } : m)))
      void loadThreads()
    } catch (error: any) {
      // The typed text goes back in the box rather than being lost.
      setMessages((current) => current.filter((m) => m.id !== tempId))
      setReply(body)
      toast.error(error?.message === 'thread_closed' ? t('supportChat.threadClosed') : errorMessage(t, error, t('common.error')))
    } finally {
      setSending(false)
    }
  }

  return { ...data, activeId, setActiveId, activeThread: data.threads.find((th) => th.id === activeId) ?? null, reply, setReply, sending, send }
}

export type SupportConversationState = ReturnType<typeof useSupportConversation>
