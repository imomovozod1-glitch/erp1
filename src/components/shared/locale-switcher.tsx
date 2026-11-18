'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { Check } from '@phosphor-icons/react'
import { CountryFlag } from '@/components/ui/country-flag'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-locale'
import { routing } from '@/i18n/routing'

/** Each language in its own words, with the flag that stands for it (SVGs, never emoji — see CountryFlag). */
export const LOCALE_OPTIONS: Record<string, { code: string; name: string; flag: string }> = {
  uz: { code: 'UZ', name: "O'zbekcha", flag: 'UZ' },
  ru: { code: 'RU', name: 'Русский', flag: 'RU' },
  en: { code: 'EN', name: 'English', flag: 'GB' },
}

/** A flag cropped to a circle — reads as a badge, the way the app's avatars do. */
export function RoundFlag({ iso, title, size = 'md' }: { iso: string; title?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/15',
        size === 'sm' ? 'size-5' : 'size-7'
      )}
    >
      <CountryFlag iso={iso} title={title} className="h-full w-auto max-w-none rounded-none ring-0 [aspect-ratio:3/2] -ml-[25%]" />
    </span>
  )
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

export function LocaleSwitcher({
  mode = 'cookie',
  className,
  onSelect,
}: {
  mode?: LocaleSwitcherMode
  /** Extra classes for the trigger, so a toolbar can match its own controls. */
  className?: string
  /** Takes over the switch (the app header keeps unsaved form input first). */
  onSelect?: (code: string) => void
}) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const setLocale = useCallback(
    (code: string) => {
      if (code === locale) return
      if (onSelect) {
        onSelect(code)
        return
      }

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
    [locale, mode, onSelect, pathname, router]
  )

  const current = LOCALE_OPTIONS[locale] ?? LOCALE_OPTIONS[routing.defaultLocale]

  return (
    <DropdownMenu>
      {/* Just the flag: the code and the arrow made the control wider than
          anything else on the bar. The name is still its accessible label. */}
      <DropdownMenuTrigger
        aria-label={current.name}
        title={current.name}
        className={cn(
          'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card/80 outline-none transition-all duration-200',
          'hover:border-violet-300 hover:bg-card data-[popup-open]:border-violet-400 data-[popup-open]:ring-4 data-[popup-open]:ring-violet-500/10',
          'focus-visible:ring-4 focus-visible:ring-violet-500/20 dark:hover:border-violet-700 dark:data-[popup-open]:border-violet-600',
          className
        )}
      >
        <RoundFlag iso={current.flag} title={current.name} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-40 rounded-2xl border border-border/60 p-1 shadow-xl shadow-violet-950/10 dark:shadow-black/40"
      >
        {routing.locales.map((code) => {
          const language = LOCALE_OPTIONS[code]
          const active = code === locale
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => setLocale(code)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-violet-50 font-semibold text-violet-800 focus:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-100 dark:focus:bg-violet-900/50'
                  : 'focus:bg-accent'
              )}
            >
              <RoundFlag iso={language.flag} title={language.name} size="sm" />
              <span className="flex-1 truncate">{language.name}</span>
              {active && <Check weight="bold" className="size-3.5 text-violet-600 dark:text-violet-300" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
