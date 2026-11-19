'use client'

import type { ReactNode } from 'react'
import { ArrowRight, Bot, Mail, Phone, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Channel {
  key: 'Telegram' | 'Phone' | 'Email'
  icon: LucideIcon
  value: string
  shown: string
  tone: { glow: string; badge: string; text: string; hover: string }
  /** A link opens; anything else is copied to the clipboard. */
  href?: string
  copyLabel?: 'phone' | 'email'
}

const CHANNELS: Channel[] = [
  {
    key: 'Telegram', icon: Bot, value: 'https://t.me/erpsupport_bot', shown: '@erpsupport_bot', href: 'https://t.me/erpsupport_bot',
    tone: { glow: 'bg-sky-500/10', badge: 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400', text: 'text-sky-600 dark:text-sky-400', hover: 'group-hover:text-sky-600' },
  },
  {
    key: 'Phone', icon: Phone, value: '+998712000000', shown: '+998 (71) 200-00-00', copyLabel: 'phone',
    tone: { glow: 'bg-emerald-500/10', badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', hover: 'group-hover:text-emerald-600' },
  },
  {
    key: 'Email', icon: Mail, value: 'support@erpsystem.uz', shown: 'support@erpsystem.uz', copyLabel: 'email',
    tone: { glow: 'bg-violet-500/10', badge: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400', text: 'text-violet-600 dark:text-violet-400', hover: 'group-hover:text-violet-700 dark:group-hover:text-violet-400' },
  },
]

const CARD = 'group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-6 text-left transition-all duration-300 hover:border-violet-400 hover:shadow-xl'

function CardBody({ channel }: { channel: Channel }) {
  const t = useTranslations('support')
  const Icon = channel.icon
  return (
    <>
      <div className={cn('absolute top-0 right-0 size-24 translate-x-4 -translate-y-4 rounded-bl-full transition-transform duration-300 group-hover:scale-110', channel.tone.glow)} />
      <div>
        <div className={cn('mb-4 w-fit rounded-2xl p-3', channel.tone.badge)}>
          <Icon className="size-6" />
        </div>
        <h3 className={cn('text-base font-semibold text-foreground transition-colors', channel.tone.hover)}>{t(`contact${channel.key}`)}</h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t(`contact${channel.key}Desc`)}</p>
      </div>
      <div className={cn('mt-4 flex items-center gap-1 text-xs font-semibold transition-all group-hover:gap-2', channel.tone.text)}>
        <span>{channel.shown}</span>
        <ArrowRight className="size-3" />
      </div>
    </>
  )
}

function ChannelCard({ channel, children }: { channel: Channel; children: ReactNode }) {
  const t = useTranslations()
  if (channel.href) {
    return (
      <a href={channel.href} target="_blank" rel="noopener noreferrer" className={CARD}>
        {children}
      </a>
    )
  }
  const copy = () => {
    navigator.clipboard.writeText(channel.value)
    toast.success(t('support.copied', { label: t(`common.${channel.copyLabel}`) }))
  }
  return (
    <button type="button" onClick={copy} className={cn(CARD, 'cursor-pointer')}>
      {children}
    </button>
  )
}

/** The three ways to reach support; the phone and the address copy themselves on a tap. */
export function ContactCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {CHANNELS.map((channel) => (
        <ChannelCard key={channel.key} channel={channel}>
          <CardBody channel={channel} />
        </ChannelCard>
      ))}
    </div>
  )
}
