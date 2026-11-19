'use client'

import { Loader2, MessageSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn, formatDateTime } from '@/lib/utils'
import { STATUS_TONE, type ThreadSummary } from './conversation-types'

function ThreadRow({ thread, active, showTenant, onOpen }: { thread: ThreadSummary; active: boolean; showTenant: boolean; onOpen: () => void }) {
  const t = useTranslations('supportChat')
  return (
    <button type="button" onClick={onOpen} className={cn('w-full px-4 py-3 text-left transition-colors hover:bg-violet-50/60 dark:hover:bg-violet-950/20', active && 'bg-violet-50 dark:bg-violet-950/30')}>
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm font-medium text-foreground">{thread.subject}</span>
        {thread.unread > 0 && <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">{thread.unread}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <StatusBadge tone={STATUS_TONE[thread.status]} label={t(`status_${thread.status}`)} />
        {thread.kind === 'agent' && <StatusBadge tone="indigo" label={t('fromAdmin')} />}
        {showTenant && thread.tenant_name && <span className="text-[11px] text-muted-foreground">{thread.tenant_name}</span>}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(thread.last_message_at)}</p>
    </button>
  )
}

interface ThreadListProps {
  threads: ThreadSummary[]
  loading: boolean
  activeId: string | null
  showTenant: boolean
  onOpen: (id: string) => void
  className?: string
}

export function ThreadList({ threads, loading, activeId, showTenant, onOpen, className }: ThreadListProps) {
  const t = useTranslations('supportChat')
  return (
    <Card className={cn('overflow-hidden border-0 shadow-sm', className)}>
      <CardContent className="max-h-[560px] overflow-y-auto p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <MessageSquare className="size-8 opacity-40" />
            <p className="text-sm">{t('noThreads')}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {threads.map((thread) => (
              <li key={thread.id}>
                <ThreadRow thread={thread} active={thread.id === activeId} showTenant={showTenant} onOpen={() => onOpen(thread.id)} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
