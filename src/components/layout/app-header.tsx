'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Bell, Globe, LogOut, Settings, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/types/database.types'

const LOCALES = [
  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]

interface AppHeaderProps {
  profile: Profile | null
  lang: string
}

export function AppHeader({ profile, lang }: AppHeaderProps) {
  const router = useRouter()
  const t = useTranslations('auth')
  const tSettings = useTranslations('settings')

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'U'

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${lang}/login`)
    router.refresh()
    toast.success('Logged out successfully')
  }

  const handleLocaleChange = (locale: string) => {
    const pathWithoutLocale = window.location.pathname.replace(`/${lang}`, '')
    router.push(`/${locale}${pathWithoutLocale}`)
  }

  const currentLocale = LOCALES.find((l) => l.code === lang)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white/80 backdrop-blur-sm px-4 sticky top-0 z-30">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="flex-1" />

      {/* Language Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-2 text-slate-600" />}>
            <Globe className="h-4 w-4" />
            <span className="text-sm font-medium">{currentLocale?.flag} {currentLocale?.code.toUpperCase()}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{tSettings('language')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {LOCALES.map((locale) => (
            <DropdownMenuItem
              key={locale.code}
              onClick={() => handleLocaleChange(locale.code)}
              className={lang === locale.code ? 'bg-indigo-50 text-indigo-700 font-medium' : ''}
            >
              <span className="mr-2">{locale.flag}</span>
              {locale.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications */}
      <Button variant="ghost" size="icon" className="relative text-slate-600">
        <Bell className="h-4 w-4" />
        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-red-500" />
      </Button>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 pl-2" />}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {profile?.full_name?.split(' ')[0] ?? 'User'}
            </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.location.href = `/${lang}/settings/profile`}>
            <User className="mr-2 h-4 w-4" />
            {tSettings('profile')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.location.href = `/${lang}/settings`}>
            <Settings className="mr-2 h-4 w-4" />
            {tSettings('title')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
