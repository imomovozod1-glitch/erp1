'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'profile', href: '/admin/settings/profile' },
  { key: 'admins', href: '/admin/settings/admins' },
] as const

export function SettingsTabs() {
  const t = useTranslations('admin.settings')
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-slate-50 p-1 w-fit dark:bg-slate-800/50 dark:border-slate-700">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => router.push(tab.href)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              isActive
                ? 'bg-white text-indigo-700 shadow-2xs dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            )}
          >
            {t(`tabs.${tab.key}`)}
          </button>
        )
      })}
    </div>
  )
}
