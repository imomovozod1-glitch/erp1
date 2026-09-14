'use client'

import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useSidebarOffset } from '@/lib/hooks/use-sidebar-offset'
import { LocaleSwitcher } from '@/components/shared/locale-switcher'
import { AdminLogoutButton } from '@/components/admin/admin-logout-button'
import { ThemeToggle } from '@/components/shared/theme-toggle'

export function AdminHeader() {
  const t = useTranslations('admin.shell')
  const sidebarOffset = useSidebarOffset()

  return (
    <header
      className={`flex h-16 shrink-0 items-center gap-3 border-b bg-white dark:bg-slate-900 dark:border-slate-800 px-4 fixed top-0 right-0 z-30 ${sidebarOffset}`}
    >
      <SidebarTrigger className="-ml-1" />
      <div className="flex-1" />
      <ThemeToggle />
      <LocaleSwitcher mode="cookie" />
      <AdminLogoutButton label={t('logout')} />
    </header>
  )
}
