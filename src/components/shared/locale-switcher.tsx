'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-locale'
import { routing } from '@/i18n/routing'

const LABELS: Record<string, string> = { uz: 'UZ', ru: 'RU', en: 'EN' }

/**
 * How the switcher persists the choice — the app has two routing models and
 * a language switch has to be applied differently in each:
 *
 * - `path`   — routes under `src/app/[lang]/**`, where next-intl's middleware
 *              resolves the locale from the URL segment. Switching means
 *              rewriting that segment (`/uz/login` → `/ru/login`).
 * - `cookie` — routes that bypass that middleware entirely (the `/admin`
 *              super-admin console and the `/support` agent portal, both
 *              fast-pathed in `src/proxy.ts`). They have no `[lang]` segment,
 *              so `src/i18n/request.ts` falls back to reading a cookie.
 */
type LocaleSwitcherMode = 'path' | 'cookie'

/** `glass` matches the translucent dark sign-in cards (see AuthCard); `default` is the in-app light/dark chrome. */
type LocaleSwitcherVariant = 'default' | 'glass'

export function LocaleSwitcher({
  mode = 'cookie',
  variant = 'default',
  className,
}: {
  mode?: LocaleSwitcherMode
  variant?: LocaleSwitcherVariant
  className?: string
}) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const setLocale = useCallback(
    (code: string) => {
      if (code === locale) return

      if (mode === 'cookie') {
        document.cookie = `${ADMIN_LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`
        router.refresh()
        return
      }

      // Swap the leading `[lang]` segment, keeping the rest of the path. The
      // query string is carried over deliberately: on the login screen it
      // holds `redirectTo`, so switching language mid-login must not lose
      // where the user was originally headed. Read from `window` rather than
      // `useSearchParams()` so this component never forces the pages that
      // render it into a Suspense boundary.
      const segments = pathname.split('/')
      if (routing.locales.includes(segments[1] as never)) {
        segments[1] = code
      } else {
        segments.splice(1, 0, code)
      }
      router.replace(`${segments.join('/')}${window.location.search}`)
    },
    [locale, mode, pathname, router]
  )

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-lg p-0.5',
        variant === 'glass'
          ? 'border border-white/10 bg-white/5'
          : 'border bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700',
        className
      )}
    >
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-current={locale === code ? 'true' : undefined}
          className={cn(
            'px-2 py-1 text-xs font-semibold rounded-md transition-colors',
            locale === code
              ? 'bg-violet-600 text-white shadow-sm'
              : variant === 'glass'
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          )}
        >
          {LABELS[code] ?? code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
