'use client'

import { useRouter } from 'next/navigation'
import { BookOpen, Check, CircleQuestionMark, HelpCircle, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useTheme } from '@/components/providers/theme-provider'
import { LOCALE_OPTIONS, RoundFlag } from '@/components/shared/locale-switcher'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database.types'
import { HEADER_CONTROL } from './header-control'

const LOCALES = [
  { code: 'uz' as const, label: "O'zbekcha" },
  { code: 'ru' as const, label: 'Русский' },
  { code: 'en' as const, label: 'English' },
]

export function HelpMenu({ lang }: { lang: string }) {
  const t = useTranslations('nav')
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" aria-label={t('help')} title={t('help')} className={cn('flex w-9 cursor-pointer items-center justify-center', HEADER_CONTROL)} />}>
        <CircleQuestionMark className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
        <DropdownMenuItem onClick={() => router.push(`/${lang}/guide`)} className="gap-2 rounded-lg py-1.5">
          <BookOpen className="size-3.5 text-violet-600" />
          <span className="text-sm">{t('guide')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/${lang}/faq`)} className="gap-2 rounded-lg py-1.5">
          <HelpCircle className="size-3.5 text-violet-600" />
          <span className="text-sm">{t('faq')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Phones only: what the bar itself shows on desktop — theme, language, help. */
function PhoneExtras({ lang, onLocale }: { lang: string; onLocale: (locale: string) => void }) {
  const t = useTranslations('nav')
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  return (
    <div className="md:hidden">
      <DropdownMenuItem onClick={() => setTheme(dark ? 'light' : 'dark')}>
        {dark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
        {t(dark ? 'lightMode' : 'darkMode')}
      </DropdownMenuItem>
      {LOCALES.map((locale) => (
        <DropdownMenuItem key={locale.code} onClick={() => onLocale(locale.code)} className="gap-2">
          <RoundFlag iso={LOCALE_OPTIONS[locale.code].flag} title={locale.label} size="sm" />
          <span className="flex-1">{locale.label}</span>
          {locale.code === lang && <Check className="size-4 text-violet-600 dark:text-violet-300" />}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem onClick={() => router.push(`/${lang}/guide`)}>
        <BookOpen className="mr-2 size-4" />
        {t('guide')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => router.push(`/${lang}/faq`)}>
        <HelpCircle className="mr-2 size-4" />
        {t('faq')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </div>
  )
}

interface UserMenuProps {
  profile: Profile | null
  lang: string
  onLocale: (locale: string) => void
  onLogout: () => void
}

export function UserMenu({ profile, lang, onLocale, onLogout }: UserMenuProps) {
  const t = useTranslations()
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-10 gap-2 rounded-full pl-1.5 max-md:px-1.5 md:h-9" />}>
        <Avatar className="size-9 ring-2 ring-violet-200 dark:ring-violet-500/40">
          <AvatarFallback className="bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">{getInitials(profile?.full_name) || 'U'}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium text-foreground sm:block">{profile?.full_name?.split(' ')[0] ?? 'User'}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Name only: the login address is a synthetic `<digits>@tenant.local`, meaningless to the reader. */}
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{profile?.full_name}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <PhoneExtras lang={lang} onLocale={onLocale} />
        <DropdownMenuItem onClick={() => router.push(`/${lang}/settings`)}>
          <Settings className="mr-2 size-4" />
          {t('settings.title')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-950/30">
          <LogOut className="mr-2 size-4" />
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
