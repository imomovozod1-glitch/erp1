'use client'

import { useEffect, useRef } from 'react'
import { ConversationPanel } from '@/components/support/conversation/conversation-panel'
import type { Viewer } from '@/components/support/conversation/conversation-types'
import { ThreadList } from '@/components/support/conversation/thread-list'
import { useSupportConversation } from '@/components/support/conversation/use-support-conversation'
import { cn } from '@/lib/utils'

interface SupportConversationProps {
  /** Collection endpoint; a thread is `${endpoint}/${id}/messages`. */
  endpoint: string
  /** Which side is reading — decides which bubbles are "mine". */
  viewer: Viewer
  /** Show the company name on each thread (agent portal only). */
  showTenantName?: boolean
  /** Refresh signal from the parent after a new thread is created. */
  refreshKey?: number
  /** Realtime inbox topic for this side, so new messages arrive as a push instead of on the poll. */
  inboxTopic?: string
  className?: string
}

/**
 * The thread list and chat shared by the tenant Support page and the agent portal: two
 * endpoints, one behaviour. Opening a thread marks it read for this side. Phones show one
 * pane at a time — the list, or the open conversation with a way back.
 */
export function SupportConversation({ endpoint, viewer, showTenantName = false, refreshKey = 0, inboxTopic, className }: SupportConversationProps) {
  const state = useSupportConversation({ endpoint, viewer, refreshKey, inboxTopic })
  const bottomRef = useRef<HTMLDivElement>(null)
  const open = state.activeId !== null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [state.messages])

  return (
    <div className={cn('grid gap-4 lg:grid-cols-[320px_1fr]', className)}>
      <ThreadList threads={state.threads} loading={state.loadingThreads} activeId={state.activeId} showTenant={showTenantName} onOpen={state.setActiveId} className={cn(open && 'max-lg:hidden')} />
      <ConversationPanel state={state} viewer={viewer} showTenant={showTenantName} onBack={() => state.setActiveId(null)} bottomRef={bottomRef} className={cn(!open && 'max-lg:hidden')} />
    </div>
  )
}
