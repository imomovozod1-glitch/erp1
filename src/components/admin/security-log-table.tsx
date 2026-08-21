'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, ShieldAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

export interface LoginAttemptRow {
  id: number
  identifier: string
  ip: string
  success: boolean
  created_at: string
}

const ITEMS_PER_PAGE = 15

export function SecurityLogTable({ attempts }: { attempts: LoginAttemptRow[] }) {
  const t = useTranslations('admin.security')
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'failed' | 'success'>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = attempts.filter((a) => {
    if (outcomeFilter === 'failed' && a.success) return false
    if (outcomeFilter === 'success' && !a.success) return false
    const q = search.toLowerCase()
    if (!q) return true
    return a.identifier.toLowerCase().includes(q) || a.ip.toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const startItem = filtered.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)

  const outcomeFilters: { value: 'all' | 'failed' | 'success'; label: string }[] = [
    { value: 'all', label: t('filterAll') },
    { value: 'failed', label: t('filterFailed') },
    { value: 'success', label: t('filterSuccess') },
  ]

  return (
    <div className="rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {outcomeFilters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setOutcomeFilter(f.value)
                  setCurrentPage(1)
                }}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
                  outcomeFilter === f.value
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
          {t('showing', { start: startItem, end: endItem, total: filtered.length })}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('colIdentifier')}</TableHead>
            <TableHead>{t('colIp')}</TableHead>
            <TableHead>{t('colOutcome')}</TableHead>
            <TableHead className="text-right">{t('colTime')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <ShieldAlert className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{tCommon('noData')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">{a.identifier}</TableCell>
                <TableCell className="text-slate-500 tabular-nums">{a.ip}</TableCell>
                <TableCell>
                  <StatusBadge
                    label={a.success ? t('success') : t('failed')}
                    tone={a.success ? 'emerald' : 'rose'}
                  />
                </TableCell>
                <TableCell className="text-right text-slate-500">{formatDateTime(a.created_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t p-4 dark:border-slate-800">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
            {tCommon('previous')}
          </Button>
          <span className="text-sm text-slate-500 px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            {tCommon('next')}
          </Button>
        </div>
      )}
    </div>
  )
}
