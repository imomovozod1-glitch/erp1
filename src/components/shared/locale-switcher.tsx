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

/**
 * Each language in its own words, plus its English name as a second line for
 * whoever cannot read the first — with the flag that stands for it (SVGs,
 * never emoji — see CountryFlag).
 */
export const LOCALE_OPTIONS: Record<string, { code: string; name: string; hint: string; flag: string }> = {
  uz: { code: 'UZ', name: "O'zbekcha", hint: 'Uzbek', flag: 'UZ' },
  ru: { code: 'RU', name: 'Русский', hint: 'Russian', flag: 'RU' },
  en: { code: 'EN', name: 'English', hint: 'English', flag: 'GB' },
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
  compact = false,
  onSelect,
}: {
  mode?: LocaleSwitcherMode
  /** Extra classes for the trigger, so a toolbar can match its own controls. */
  className?: string
  /** Flag only below `sm` — for a crowded bar. */
  compact?: boolean
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
      <DropdownMenuTrigger
        aria-label={current.name}
        className={cn(
          'group inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card/80 py-1 pr-2.5 pl-1 text-xs font-semibold text-foreground shadow-2xs outline-none backdrop-blur transition-all duration-200',
          'hover:border-violet-300 hover:bg-card hover:shadow-sm data-[popup-open]:border-violet-400 data-[popup-open]:ring-4 data-[popup-open]:ring-violet-500/10',
          'focus-visible:ring-4 focus-visible:ring-violet-500/20 dark:hover:border-violet-700 dark:data-[popup-open]:border-violet-600',
          compact && 'max-sm:size-9 max-sm:justify-center max-sm:p-0',
          className
        )}
      >
        <RoundFlag iso={current.flag} title={current.name} />
        <span className={cn('tracking-wide tabular-nums', compact && 'max-sm:hidden')}>{current.code}</span>
        <CaretDown
          weight="bold"
          className={cn(
            'size-3 text-muted-foreground transition-transform duration-200 group-data-[popup-open]:rotate-180',
            compact && 'max-sm:hidden'
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-60 rounded-2xl border border-border/60 p-1.5 shadow-xl shadow-violet-950/10 dark:shadow-black/40"
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
                'flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors',
                active
                  ? 'bg-violet-50 text-violet-800 focus:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-100 dark:focus:bg-violet-900/50'
                  : 'focus:bg-accent'
              )}
            >
              <RoundFlag iso={language.flag} title={language.name} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">{language.name}</span>
                <span className={cn('text-[11px]', active ? 'text-violet-600/80 dark:text-violet-300/80' : 'text-muted-foreground')}>
                  {language.hint}
                </span>
              </span>
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                  active ? 'bg-brand-gradient text-white shadow-brand' : 'border border-border'
                )}
              >
                {active && <Check weight="bold" className="size-3" />}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
