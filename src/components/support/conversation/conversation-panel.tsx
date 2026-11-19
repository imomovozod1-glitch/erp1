'use client'

import { ArrowLeft, Loader2, MessageSquare, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatDateTime } from '@/lib/utils'
import { isMine, ROLE_ICON, type Message, type Viewer } from './conversation-types'
import type { SupportConversationState } from './use-support-conversation'

function Bubble({ message, viewer }: { message: Message; viewer: Viewer }) {
  const t = useTranslations('supportChat')
  const mine = isMine(message, viewer)
  const Icon = ROLE_ICON[message.sender_role]
  const tone = mine
    ? 'rounded-br-sm bg-violet-600 text-white'
    : message.sender_role === 'admin'
      ? 'rounded-bl-sm bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
      : 'rounded-bl-sm bg-muted text-foreground'
  return (
    <div className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start')}>
      {!mine && (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-3.5" />
        </div>
      )}
      <div className={cn('max-w-[75%] rounded-2xl px-3.5 py-2 text-sm transition-opacity', message.pending && 'opacity-60', tone)}>
        {!mine && (
          <p className="mb-0.5 text-[11px] font-semibold opacity-80">
            {message.sender_name}
            {message.sender_role === 'admin' && ` · ${t('fromAdmin')}`}
          </p>
        )}
        <p className="wrap-break-word whitespace-pre-wrap">{message.body}</p>
        <p className={cn('mt-1 text-[10px]', mine ? 'text-white/70' : 'text-muted-foreground')}>{formatDateTime(message.created_at)}</p>
      </div>
    </div>
  )
}

// Enter sends, Shift+Enter makes a new line — what people expect from a chat box.
function Composer({ state }: { state: SupportConversationState }) {
  const t = useTranslations('supportChat')
  return (
    <div className="flex items-end gap-2">
      <Textarea
        value={state.reply}
        onChange={(e) => state.setReply(e.target.value)}
        placeholder={t('replyPlaceholder')}
        rows={2}
        className="resize-none"
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey) return
          e.preventDefault()
          void state.send()
        }}
      />
      <Button onClick={state.send} disabled={state.sending || !state.reply.trim()} size="icon-lg" aria-label={t('replyPlaceholder')}>
        {state.sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </Button>
    </div>
  )
}

interface PanelProps {
  state: SupportConversationState
  viewer: Viewer
  showTenant: boolean
  onBack: () => void
  bottomRef: React.RefObject<HTMLDivElement | null>
  className?: string
}

export function ConversationPanel({ state, viewer, showTenant, onBack, bottomRef, className }: PanelProps) {
  const t = useTranslations()
  const thread = state.activeThread
  if (!thread) {
    return (
      <Card className={cn('flex min-h-[560px] flex-col border-0 shadow-sm', className)}>
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <MessageSquare className="size-10 opacity-30" />
          <p className="text-sm">{t('supportChat.selectThread')}</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className={cn('flex min-h-[560px] flex-col border-0 shadow-sm', className)}>
      <div className="flex items-center gap-2 border-b px-5 py-3 max-lg:px-3">
        {/* Phones show one pane at a time; this returns to the list. */}
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('common.back')} className="lg:hidden">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground">{thread.subject}</h3>
          {showTenant && thread.tenant_name && <p className="text-xs text-muted-foreground">{thread.tenant_name}</p>}
        </div>
      </div>
      <div className="max-h-[400px] flex-1 space-y-3 overflow-y-auto px-5 py-4 max-lg:max-h-[60dvh] max-lg:px-3">
        {state.loadingMessages ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          state.messages.map((message) => <Bubble key={message.id} message={message} viewer={viewer} />)
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3">{thread.status === 'closed' ? <p className="py-2 text-center text-xs text-muted-foreground">{t('supportChat.threadClosed')}</p> : <Composer state={state} />}</div>
    </Card>
  )
}
