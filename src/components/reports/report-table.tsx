'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { MobileCardList } from '@/components/shared/mobile-list'

export interface ReportColumn<T> {
  key: string
  header: string
  /** Numbers right-align; everything else reads better left. */
  align?: 'left' | 'right'
  /** Hide below a breakpoint on narrow screens (a Tailwind `hidden md:table-cell`-style class). */
  className?: string
  render: (row: T, index: number) => ReactNode
}

/**
 * The ranked table every report ends with: optional search, local pagination,
 * an empty state.
 *
 * Local `currentPage` state and `.slice()` rather than the URL-driven
 * `TablePagination`, because report rows are computed in the browser from data
 * already in memory — there is no server round trip to put in the query
 * string, and the period filter above already owns the URL-less view state.
 * Follows the hand-rolled pagination convention in AGENTS.md § Table
 * Interfaces.
 */
export function ReportTable<T>({
  rows,
  columns,
  rowKey,
  title,
  searchable,
  searchPlaceholder,
  filterRow,
  pageSize = 12,
  footer,
}: {
  rows: T[]
  columns: ReportColumn<T>[]
  rowKey: (row: T, index: number) => string
  title?: string
  searchable?: boolean
  searchPlaceholder?: string
  /** Used when `searchable`; return true if the row matches the typed needle. */
  filterRow?: (row: T, needle: string) => boolean
  pageSize?: number
  footer?: ReactNode
}) {
  const tc = useTranslations('common')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const needle = query.trim().toLowerCase()
  const visible =
    needle && filterRow ? rows.filter((row) => filterRow(row, needle)) : rows

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  // Clamp rather than reset-on-change: filtering down to fewer pages while
  // sitting on page 5 would otherwise render an empty table.
  const currentPage = Math.min(page, totalPages)
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  // On a phone: up to five columns read fine as cards; wider reports stay a
  // table that scrolls sideways inside this rounded card, first column pinned.
  const asCards = columns.length <= 5
  const [first, ...rest] = columns

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white md:rounded-xl dark:border-slate-800 dark:bg-slate-900">
      {(title || searchable) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          {title && (
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
          )}
          {searchable && (
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder={searchPlaceholder ?? `${tc('search')}...`}
                className="h-10 pl-9 text-sm md:h-9"
              />
            </div>
          )}
        </div>
      )}

      {asCards && first && (
        <MobileCardList
          className="p-3"
          isEmpty={pageRows.length === 0}
          empty={
            <div className="py-10 text-center">
              <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-700" />
              <span className="text-sm text-slate-400 dark:text-slate-500">{tc('noData')}</span>
            </div>
          }
        >
          {pageRows.map((row, index) => (
            <article
              key={rowKey(row, index)}
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
            >
              <div className="min-w-0 font-semibold leading-snug break-words">
                {first.render(row, (currentPage - 1) * pageSize + index)}
              </div>
              {rest.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/60 pt-3">
                  {rest.map((col) => (
                    <div key={col.key} className="min-w-0">
                      <dt className="truncate text-[11px] text-muted-foreground">{col.header}</dt>
                      <dd className="text-sm font-semibold tabular-nums break-words">
                        {col.render(row, (currentPage - 1) * pageSize + index)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          ))}
        </MobileCardList>
      )}

      <Table containerClassName={asCards ? 'max-md:hidden' : undefined}>
        <TableHeader>
          <TableRow>
            {columns.map((col, ci) => (
              <TableHead
                key={col.key}
                className={cn(
                  col.align === 'right' && 'text-right',
                  col.className,
                  ci === 0 && 'max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-white max-md:dark:bg-slate-900'
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-12 text-center">
                <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-700" />
                <span className="text-sm text-slate-400 dark:text-slate-500">{tc('noData')}</span>
              </TableCell>
            </TableRow>
          ) : (
            pageRows.map((row, index) => (
              <TableRow key={rowKey(row, index)}>
                {columns.map((col, ci) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      col.align === 'right' && 'text-right tabular-nums',
                      col.className,
                      ci === 0 && 'max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-white max-md:dark:bg-slate-900'
                    )}
                  >
                    {col.render(row, (currentPage - 1) * pageSize + index)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {footer}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
