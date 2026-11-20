'use client'

import Link from 'next/link'
import { LifeBuoy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database.types'
import { FalcoMark } from '@/components/shared/falco-logo'

// `min-h-12` keeps the 48px row in the icon rail, so the icons below never shift up on collapse.
export function BrandButton({ lang, onNavigate }: { lang: string; onNavigate: () => void }) {
  const t = useTranslations('nav')
  return (
    <SidebarMenuButton size="lg" tooltip="Falco" className="group-data-[collapsible=icon]:min-h-12" render={<Link href={`/${lang}/dashboard`} prefetch onClick={onNavigate} />}>
      <FalcoMark className="size-8!" />
      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate font-semibold">Falco</span>
        <span className="truncate text-xs text-muted-foreground">{t('brandTagline')}</span>
      </div>
    </SidebarMenuButton>
  )
}

function SupportButton({ lang, onNavigate }: { lang: string; onNavigate: () => void }) {
  const t = useTranslations('nav')
  return (
    <SidebarMenuButton
      size="lg"
      tooltip={t('support')}
      render={<Link href={`/${lang}/support`} prefetch onClick={onNavigate} />}
      className="gap-3 text-foreground transition-colors duration-200 hover:bg-muted hover:text-violet-700 dark:hover:text-violet-400"
    >
      <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 transition-colors dark:bg-violet-950/40 dark:text-violet-400">
        <LifeBuoy className="size-4 animate-pulse" />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate font-semibold">{t('support')}</span>
        <span className="truncate text-xs text-muted-foreground">{t('helpDesk')}</span>
      </div>
    </SidebarMenuButton>
  )
}

// Members sign in by phone; their email is a synthetic `{digits}@….tenant.local`, so the phone is shown instead.
const contactOf = (profile: Profile | null) => (profile?.email?.endsWith('.tenant.local') ? (profile as { phone?: string | null }).phone || '' : profile?.email)

/** Admins get the support desk here; everyone else their own account, linking to settings. */
export function SidebarAccount({ profile, lang, onNavigate }: { profile: Profile | null; lang: string; onNavigate: () => void }) {
  const t = useTranslations('settings')
  if (profile?.role === 'admin') return <SupportButton lang={lang} onNavigate={onNavigate} />
  return (
    <SidebarMenuButton size="lg" tooltip={profile?.full_name ?? 'User'} render={<Link href={`/${lang}/settings`} prefetch onClick={onNavigate} />}>
      <Avatar className="size-8 shrink-0 rounded-lg">
        <AvatarFallback className="rounded-lg bg-violet-100 text-xs font-semibold text-violet-700">{getInitials(profile?.full_name) || 'U'}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate font-semibold">{profile?.full_name ?? 'User'}</span>
        <span className="truncate text-xs text-muted-foreground">{contactOf(profile)}</span>
      </div>
      <Badge variant="outline" className="ml-auto border-violet-200 px-1.5 text-[10px] text-violet-600 capitalize group-data-[collapsible=icon]:hidden">
        {profile?.role ? t(`role.${profile.role}`) : ''}
      </Badge>
    </SidebarMenuButton>
  )
}
