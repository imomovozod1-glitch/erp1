'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutGrid, Package, Receipt, Store, Menu } from 'lucide-react'
import { useSidebar } from '@/components/ui/sidebar'
import { hasViewAccess, type PermissionModule } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database.types'

interface Tab {
  key: 'dashboard' | 'pos' | 'inventory' | 'orders'
  icon: React.ElementType
  href: string
  /** Permission module that must be viewable; `null` is always shown. */
  module: PermissionModule | null
}

/**
 * The four places a phone user spends their day, plus "More" for the rest.
 * Mirrors the sidebar's permission rule (see app-sidebar.tsx): a tab for a
 * module the user cannot view is simply not drawn.
 */
const TABS: Tab[] = [
  { key: 'dashboard', icon: LayoutGrid, href: 'dashboard', module: null },
  { key: 'pos', icon: Store, href: 'pos', module: 'pos' },
  { key: 'inventory', icon: Package, href: 'inventory/products', module: 'inventory' },
  { key: 'orders', icon: Receipt, href: 'sales/orders', module: 'sales' },
]

/**
 * Bottom navigation for phones and small tablets (the Android app, mostly).
 * The sidebar becomes a sheet below `md`, which is two taps from anywhere; this
 * puts the main destinations under the thumb and leaves the sheet for "More".
 */
export function BottomNav({ lang, profile }: { lang: string; profile: Profile | null }) {
  const pathname = usePathname()
  const tNav = useTranslations('nav')
  const tSales = useTranslations('sales')
  const { setOpenMobile } = useSidebar()

  const tabs = TABS.filter(
    (tab) => !tab.module || hasViewAccess(profile?.role, (profile as { permissions?: unknown } | null)?.permissions, tab.module)
  )

  const label = (key: Tab['key']) =>
    key === 'orders' ? tSales('orders') : key === 'dashboard' ? tNav('dashboardShort') : tNav(key)
  // Inventory's tab goes to the products list, but any inventory page lights it.
  const isActive = (tab: Tab) => {
    const root = `/${lang}/${tab.href.split('/')[0]}`
    return tab.key === 'orders'
      ? pathname.startsWith(`/${lang}/sales`)
      : pathname === root || pathname.startsWith(`${root}/`)
  }

  return (
    <nav
      aria-label={tNav('platform')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-[var(--chrome)] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab)
          const Icon = tab.icon
          return (
            <li key={tab.key} className="min-w-0 flex-1">
              <Link
                href={`/${lang}/${tab.href}`}
                prefetch={true}
                aria-current={active ? 'page' : undefined}
                className="group flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1 outline-none"
              >
                <span
                  className={cn(
                    'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200',
                    active
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                      : 'text-muted-foreground group-active:bg-violet-50 dark:group-active:bg-violet-500/10'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span
                  className={cn(
                    'max-w-full truncate text-[11px] leading-tight',
                    active ? 'font-bold text-violet-700 dark:text-violet-300' : 'font-medium text-muted-foreground'
                  )}
                >
                  {label(tab.key)}
                </span>
              </Link>
            </li>
          )
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="group flex w-full flex-col items-center gap-0.5 rounded-2xl px-1 py-1 outline-none"
          >
            <span className="flex h-8 w-14 items-center justify-center rounded-full text-muted-foreground transition-colors group-active:bg-violet-50 dark:group-active:bg-violet-500/10">
              <Menu className="h-5 w-5" />
            </span>
            <span className="max-w-full truncate text-[11px] font-medium leading-tight text-muted-foreground">{tNav('more')}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
