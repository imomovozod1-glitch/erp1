'use client'

import { useTranslations } from 'next-intl'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { AdminLocaleSwitcher } from '@/components/admin/admin-locale-switcher'
import { AdminLogoutButton } from '@/components/admin/admin-logout-button'

export function AdminHeader() {
  const t = useTranslations('admin.shell')
  const { state: sidebarState, isMobile: isSidebarMobile } = useSidebar()

  return (
    <header
      className={`flex h-16 shrink-0 items-center gap-3 border-b bg-white dark:bg-slate-900 dark:border-slate-800 px-4 fixed top-0 right-0 z-30 transition-[left] duration-200 ease-linear ${
        isSidebarMobile ? 'left-0' : sidebarState === 'expanded' ? 'left-0 md:left-(--sidebar-width)' : 'left-0 md:left-(--sidebar-width-icon)'
      }`}
    >
      <SidebarTrigger className="-ml-1" />
      <div className="flex-1" />
      <AdminLocaleSwitcher />
      <AdminLogoutButton label={t('logout')} />
    </header>
  )
}
