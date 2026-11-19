'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bell, Check, CheckCircle2, Clock, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn, formatDate } from '@/lib/utils'
import { HEADER_CONTROL } from './header-control'
import type { HeaderNotification, NotificationType } from './notifications'
import type { NotificationsState } from './use-notifications'

const KIND: Record<NotificationType, { icon: typeof Bell; tone: string }> = {
  low_stock: { icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
  overdue_invoice: { icon: Clock, tone: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' },
  support_reply: { icon: MessageCircle, tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400' },
}

function NotificationRow({ item, onOpen }: { item: HeaderNotification; onOpen: () => void }) {
  const { icon: Icon, tone } = KIND[item.type]
  const unread = !item.read
  return (
    <button type="button" onClick={onOpen} className={cn('flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/60', unread && 'bg-violet-50/30 dark:bg-violet-950/20')}>
      <span className={cn('mt-0.5 rounded-xl p-2', tone)}>
        <Icon className="size-4" />
      </span>
      <span className="flex-1 space-y-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className={cn('text-xs font-semibold', unread ? 'text-foreground' : 'text-muted-foreground')}>{item.title}</span>
          <span className="text-[10px] text-muted-foreground">{formatDate(item.created_at.toISOString())}</span>
        </span>
        <span className={cn('block text-xs', unread ? 'font-medium text-foreground/80' : 'text-muted-foreground')}>{item.description}</span>
      </span>
      {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-violet-600 dark:bg-violet-400" />}
    </button>
  )
}

function AllCaughtUp() {
  const t = useTranslations('nav.notifications')
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <CheckCircle2 className="mb-2 size-8 text-emerald-500 dark:text-emerald-400" />
      <p className="text-sm font-medium text-foreground">{t('allCaughtUp')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('empty')}</p>
    </div>
  )
}

export function NotificationsMenu({ state }: { state: NotificationsState }) {
  const t = useTranslations('nav.notifications')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const openItem = (item: HeaderNotification) => {
    state.markRead(item.id)
    setOpen(false)
    router.push(item.href)
  }
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t('title')} className={cn('relative w-9', HEADER_CONTROL)}>
            <Bell className="size-4" />
            {state.unread > 0 && (
              <span className="absolute top-2 right-2 flex size-2 max-md:top-1.5 max-md:right-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 overflow-hidden rounded-xl border p-0 shadow-lg sm:w-96">
        <div className="flex items-center justify-between border-b bg-muted/40 p-4">
          <span className="text-sm font-semibold text-foreground">
            {t('title')}
            {state.unread > 0 && <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{state.unread}</span>}
          </span>
          {state.unread > 0 && (
            <button type="button" onClick={state.markAllRead} className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300">
              <Check className="size-3" />
              {t('markAllRead')}
            </button>
          )}
        </div>
        <div className="max-h-[300px] divide-y overflow-y-auto">
          {state.items.length === 0 ? <AllCaughtUp /> : state.items.map((item) => <NotificationRow key={item.id} item={item} onOpen={() => openItem(item)} />)}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
