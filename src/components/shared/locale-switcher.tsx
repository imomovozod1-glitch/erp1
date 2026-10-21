'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { CaretDown, Check } from '@phosphor-icons/react'
import { CountryFlag } from '@/components/ui/country-flag'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-locale'
import { routing } from '@/i18n/routing'

/** Each language in its own words, with the flag that stands for it (SVGs, never emoji — see CountryFlag). */
const LANGUAGES: Record<string, { code: string; name: string; flag: string }> = {
  uz: { code: 'UZ', name: "O'zbekcha", flag: 'UZ' },
  ru: { code: 'RU', name: 'Русский', flag: 'RU' },
  en: { code: 'EN', name: 'English', flag: 'GB' },
}

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

/** `glass` matches the always-dark sign-in cards (see AuthCard); `default` is the in-app light/dark chrome. */
type LocaleSwitcherVariant = 'default' | 'glass'

const TRIGGER: Record<LocaleSwitcherVariant, string> = {
  default:
    'border border-slate-900/10 bg-white/70 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10',
  glass: 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
}

// The menu is portalled out of the card it opens from, so it cannot inherit the
// card's always-dark look — the glass variant states it.
const MENU: Record<LocaleSwitcherVariant, string> = {
  default: 'w-44 rounded-xl p-1.5',
  glass: 'w-44 rounded-xl border border-white/10 bg-slate-900 p-1.5 text-white ring-0',
}

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
      // query string and the #hash are carried over deliberately: on the login
      // screen the query holds `redirectTo`, and on the landing page the hash
      // is the section the visitor is reading. Read from `window` rather than
      // `useSearchParams()` so this component never forces the pages that
      // render it into a Suspense boundary.
      const segments = pathname.split('/')
      if (routing.locales.includes(segments[1] as never)) {
        segments[1] = code
      } else {
        segments.splice(1, 0, code)
      }
      router.replace(`${segments.join('/')}${window.location.search}${window.location.hash}`)
    },
    [locale, mode, pathname, router]
  )

  const current = LANGUAGES[locale] ?? LANGUAGES[routing.defaultLocale]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={current.name}
        className={cn(
          'group inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold outline-none backdrop-blur transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/50',
          TRIGGER[variant],
          className
        )}
      >
        <CountryFlag iso={current.flag} title={current.name} />
        {current.code}
        <CaretDown
          weight="bold"
          className="h-3 w-3 opacity-60 transition-transform duration-200 group-data-[popup-open]:rotate-180"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className={MENU[variant]}>
        {routing.locales.map((code) => {
          const language = LANGUAGES[code]
          const active = code === locale
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => setLocale(code)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm',
                variant === 'glass' && 'focus:bg-white/10 focus:text-white',
                active && 'font-semibold'
              )}
            >
              <CountryFlag iso={language.flag} title={language.name} />
              <span className="flex-1">{language.name}</span>
              {active && <Check weight="bold" className="h-4 w-4 text-violet-500 dark:text-violet-300" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
