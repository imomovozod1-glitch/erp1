'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-locale'

const LOCALES = [
  { code: 'uz', label: 'UZ' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
] as const

export function AdminLocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()

  const setLocale = useCallback(
    (code: string) => {
      if (code === locale) return
      document.cookie = `${ADMIN_LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`
      router.refresh()
    },
    [locale, router]
  )

  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-slate-50 p-0.5 dark:bg-slate-800/50 dark:border-slate-700">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          className={cn(
            'px-2 py-1 text-xs font-semibold rounded-md transition-colors',
            locale === l.code
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
