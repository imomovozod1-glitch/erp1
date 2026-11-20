'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AlertTriangle, LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useFeature } from '@/components/providers/features-provider'
import { BackButton } from '@/components/shared/back-button'
import { useConfirm } from '@/components/shared/confirm-dialog'
import { LocaleSwitcher } from '@/components/shared/locale-switcher'
import { StatusBadge } from '@/components/shared/status-badge'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { GlobalSearch } from '@/components/layout/global-search'
import { HEADER_CONTROL } from '@/components/layout/header/header-control'
import { HelpMenu, UserMenu } from '@/components/layout/header/header-menus'
import { NotificationsMenu } from '@/components/layout/header/notifications-menu'
import { useLocaleSwitch } from '@/components/layout/header/use-locale-switch'
import { useNotifications } from '@/components/layout/header/use-notifications'
import { useSidebarOffset } from '@/lib/hooks/use-sidebar-offset'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database.types'
import { FalcoMark } from '@/components/shared/falco-logo'

interface AppHeaderProps {
  profile: Profile | null
  lang: string
}

/** Pathname segments that name a module — the phone app bar's title. */
const MODULES = new Set(['dashboard', 'reports', 'pos', 'inventory', 'sales', 'customers', 'procurement', 'finance', 'hr', 'production', 'distribution', 'settings', 'guide', 'faq', 'support'])

/** Phones: the brand mark (or a back chip inside a sub-page) and the module the user is in. */
function PhoneTitle({ lang }: { lang: string }) {
  const t = useTranslations('nav')
  const segments = usePathname().split('/').filter(Boolean)
  const section = segments[1]
  return (
    <div className="flex min-w-0 items-center gap-2.5 md:hidden">
      {segments.length > 2 ? (
        <BackButton className="size-9 rounded-xl border-border/60 bg-card text-foreground shadow-sm hover:bg-violet-50 dark:bg-card" />
      ) : (
        <Link href={`/${lang}/dashboard`} aria-label="Falco" className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
          <FalcoMark className="size-6" />
        </Link>
      )}
      <div className="min-w-0 leading-tight">
        <p className="text-[10px] font-extrabold tracking-[0.16em] text-violet-700 uppercase dark:text-violet-300">Falco</p>
        <p className="truncate text-lg font-bold tracking-tight">{section && MODULES.has(section) ? t(section) : 'Falco'}</p>
      </div>
    </div>
  )
}

// Rose because it classifies late money; not animated, or it stops meaning "look here" within a day.
function OverdueButton({ lang }: { lang: string }) {
  const t = useTranslations('nav')
  const router = useRouter()
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(`/${lang}/sales/invoices?status=overdue`)}
      title={t('overdue')}
      className="size-8 justify-center gap-1.5 rounded-lg border-rose-200 bg-rose-50 px-0 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800 sm:w-auto sm:px-3 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60"
    >
      <AlertTriangle className="size-3.5 shrink-0 text-rose-600" />
      <span className="hidden sm:inline">{t('overdue')}</span>
    </Button>
  )
}

// Signing out drops whatever half-filled form is open, so it asks first; then a full load, never a cached signed-in page.
function useLogout(lang: string) {
  const t = useTranslations()
  const [confirm, confirmDialog] = useConfirm()
  const logout = async () => {
    const ok = await confirm({ title: t('common.confirmLogoutTitle'), description: t('common.confirmLogoutDescription'), confirmLabel: t('auth.logout'), confirmIcon: LogOut })
    if (!ok) return
    await createClient().auth.signOut()
    window.location.replace(`/${lang}/login`)
  }
  return { logout, confirmDialog }
}

export function AppHeader({ profile, lang }: AppHeaderProps) {
  const t = useTranslations()
  const sidebarOffset = useSidebarOffset()
  // The release-testing company shares the live database; the badge keeps its orders from passing for real ones.
  const isTestCompany = useFeature('test_company')
  const notifications = useNotifications(profile, lang)
  const switchLocale = useLocaleSwitch(lang)
  const { logout, confirmDialog } = useLogout(lang)
  return (
    <header className={`fixed top-0 right-0 z-30 flex min-h-14 shrink-0 items-center gap-1.5 border-b border-border/60 bg-[var(--chrome)] px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:gap-2 md:min-h-16 ${sidebarOffset}`}>
      <SidebarTrigger className="-ml-1 hidden md:order-first md:inline-flex" />
      <PhoneTitle lang={lang} />
      {isTestCompany && <StatusBadge label={t('common.testCompany')} tone="amber" />}
      <div className="flex-1" />
      {/* After the spacer, so the phone's search icon sits at the right edge; on desktop it is `md:order-first`. */}
      <GlobalSearch lang={lang} role={profile?.role} permissions={(profile as any)?.permissions} userId={profile?.id ?? null} />
      {notifications.hasOverdue && <OverdueButton lang={lang} />}
      <div className="hidden items-center gap-1.5 sm:gap-2 md:contents">
        <HelpMenu lang={lang} />
        <LocaleSwitcher mode="path" onSelect={switchLocale} />
        <ThemeToggle className={`w-9 ${HEADER_CONTROL}`} labels={{ light: t('nav.lightMode'), dark: t('nav.darkMode') }} />
      </div>
      <NotificationsMenu state={notifications} />
      <UserMenu profile={profile} lang={lang} onLocale={switchLocale} onLogout={logout} />
      {confirmDialog}
    </header>
  )
}
