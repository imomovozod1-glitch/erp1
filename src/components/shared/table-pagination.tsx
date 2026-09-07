'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * URL-driven search + pagination controls, shared by every server-paginated
 * list.
 *
 * State lives in the query string (`?page=2&q=coca`) rather than in component
 * state, because the rows themselves are now fetched on the server: the page
 * has to re-render to get page 2, and putting the position in the URL also
 * makes a list view linkable and survive a refresh or a back button — none of
 * which the previous in-memory `useState(currentPage)` could do.
 */

function useUrlState() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  return { searchParams, setParams, isPending }
}

export function TableSearch({ placeholder }: { placeholder?: string }) {
  const tCommon = useTranslations('common')
  const { searchParams, setParams, isPending } = useUrlState()
  const urlQuery = searchParams.get('q') ?? ''
  const [value, setValue] = useState(urlQuery)

  // Keep the box in step when the URL changes from elsewhere (back button, a
  // filter chip clearing the search). Done by adjusting state during render —
  // React's documented pattern for "reset state when a prop changes" — rather
  // than in an effect, which would be a cascading render
  // (react-hooks/set-state-in-effect).
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    setValue(urlQuery)
  }

  // Debounced: each committed search is a server round trip, so firing one per
  // keystroke would queue a request per character typed.
  useEffect(() => {
    if (value === urlQuery) return
    const timer = setTimeout(() => setParams({ q: value || null, page: null }), 350)
    return () => clearTimeout(timer)
  }, [value, urlQuery, setParams])

  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? `${tCommon('search')}...`}
        className="pl-9"
      />
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
}) {
  const tCommon = useTranslations('common')
  const { setParams, isPending } = useUrlState()

  // Still worth rendering the count line for a single page — "1-7 / 7" tells
  // the user they are seeing everything, which an absent footer does not.
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
      <p className="text-xs text-muted-foreground tabular-nums">
        {tCommon('showingRange', { first, last, total })}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setParams({ page: String(page - 1) })}
            disabled={page <= 1 || isPending}
          >
            <ChevronLeft className="h-4 w-4" />
            {tCommon('previous')}
          </Button>
          <span className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 tabular-nums dark:bg-violet-950/40 dark:text-violet-300">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setParams({ page: String(page + 1) })}
            disabled={page >= totalPages || isPending}
          >
            {tCommon('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/** Filter chips that write their value into the query string. */
export function TableFilterChips({
  param,
  options,
  value,
}: {
  param: string
  options: { value: string; label: string }[]
  value: string
}) {
  const { setParams, isPending } = useUrlState()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'default' : 'outline'}
          size="sm"
          disabled={isPending}
          onClick={() => setParams({ [param]: option.value === 'all' ? null : option.value, page: null })}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
