'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Back" control for page headers.
 *
 * `router.back()` alone is wrong here: a page reached by typing a URL, by a
 * notification, or as the first page of the session has nothing behind it in
 * history — pressing back then leaves the app entirely, or does nothing at
 * all. So the parent route (the pathname minus its last segment) is computed
 * up front and used whenever history can't be trusted, which also makes the
 * destination predictable: from a detail page you always land on its list.
 *
 * `/uz/dashboard` and `/uz` have no parent worth going to, so the button
 * simply isn't rendered there — see `parentPath` returning null.
 */
export function BackButton({
  href,
  className,
}: {
  /** Overrides the derived parent, for the rare page whose parent isn't its URL prefix. */
  href?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('common')

  const fallback = href ?? parentPath(pathname)
  if (!fallback) return null

  const handleClick = () => {
    // `history.length > 1` means *this tab* has somewhere to go back to. It
    // can still be another site, which is why the parent route is the
    // fallback rather than the primary path.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallback)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('back')}
      title={t('back')}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  )
}

/**
 * The route one level up, or null when there isn't one.
 *
 * Locale-aware: `/uz/inventory/products` → `/uz/inventory`, but
 * `/uz/dashboard` → null, because the dashboard is already the root of the
 * authenticated app and "up" from it is the login screen.
 */
export function parentPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 1) return null

  // The admin console is not locale-prefixed and its intermediate paths are
  // not all routes (`/admin/settings` has no page of its own, only children),
  // so anything below it falls back to the console root rather than to a
  // URL that would 404.
  if (segments[0] === 'admin') return '/admin'

  // A top-level module page (`/uz/settings`) goes up to the dashboard; the
  // dashboard itself is the root and has nowhere to go.
  if (segments.length === 2) {
    return segments[1] === 'dashboard' ? null : `/${segments[0]}/dashboard`
  }
  return `/${segments.slice(0, -1).join('/')}`
}
