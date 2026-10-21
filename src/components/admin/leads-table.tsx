'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Inbox, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { adminErrorMessage } from '@/lib/admin-errors'
import { formatDateTime, cn } from '@/lib/utils'
import { MobileCard, MobileCardList } from '@/components/shared/mobile-list'

export type LeadStatus = 'new' | 'contacted' | 'closed'

export interface LeadRow {
  id: string
  name: string
  company: string
  phone: string
  comment: string | null
  lang: string | null
  status: LeadStatus
  created_at: string
}

const STATUSES: LeadStatus[] = ['new', 'contacted', 'closed']
const TONES: Record<LeadStatus, StatusTone> = { new: 'indigo', contacted: 'amber', closed: 'emerald' }
const ITEMS_PER_PAGE = 15

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const t = useTranslations('admin.leads')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('admin.errors')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [saving, setSaving] = useState<string | null>(null)

  const filtered = leads.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    const q = search.toLowerCase().trim()
    if (!q) return true
    return [l.name, l.company, l.phone].some((v) => v.toLowerCase().includes(q))
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const startItem = filtered.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)

  async function setStatus(lead: LeadRow, status: LeadStatus) {
    if (status === lead.status) return
    setSaving(lead.id)
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        toast.error(adminErrorMessage(tErrors, await res.json().catch(() => null), t('updateFailed')))
        return
      }
      // A plain API route, not a cached read: the page is force-dynamic, so a
      // refresh is all it takes to show the new status and the stat tiles.
      router.refresh()
    } catch {
      toast.error(t('updateFailed'))
    } finally {
      setSaving(null)
    }
  }

  const filters: { value: 'all' | LeadStatus; label: string }[] = [
    { value: 'all', label: t('filterAll') },
    ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
  ]

  return (
    <div className="rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 dark:border-slate-800">
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <div className="relative w-full md:max-w-xs md:w-64">
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
          <div className="-mx-1 flex max-w-full items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] max-md:w-full">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setStatusFilter(f.value)
                  setCurrentPage(1)
                }}
                className={cn(
                  'shrink-0 whitespace-nowrap px-3 py-2 md:py-1.5 text-xs font-semibold rounded-full border transition-colors',
                  statusFilter === f.value
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
          {t('showing', { start: startItem, end: endItem, total: filtered.length })}
        </span>
      </div>

      <MobileCardList
        className="p-3"
        isEmpty={paginated.length === 0}
        empty={
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400 dark:text-slate-500">
            <Inbox className="h-8 w-8 opacity-40" />
            <p className="text-sm">{tCommon('noData')}</p>
          </div>
        }
      >
        {paginated.map((lead) => (
          <MobileCard
            key={lead.id}
            eyebrow={<span className="tabular-nums">{formatDateTime(lead.created_at)}</span>}
            title={lead.name}
            subtitle={lead.company}
            status={
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={saving === lead.id}
                  className="flex min-h-10 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-50"
                >
                  <StatusBadge label={t(`status.${lead.status}`)} tone={TONES[lead.status]} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatus(lead, s)}>
                      {t(`status.${s}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
            footer={
              <div className="space-y-2">
                <a
                  href={`tel:${lead.phone}`}
                  className="flex h-11 items-center justify-center rounded-xl bg-violet-50 text-sm font-semibold tabular-nums text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                >
                  {lead.phone}
                </a>
                {lead.comment && <p className="break-words text-xs text-slate-500 dark:text-slate-400">{lead.comment}</p>}
              </div>
            }
          />
        ))}
      </MobileCardList>

      <Table containerClassName="max-md:hidden">
        <TableHeader>
          <TableRow>
            <TableHead>{t('colName')}</TableHead>
            <TableHead>{t('colCompany')}</TableHead>
            <TableHead>{t('colPhone')}</TableHead>
            <TableHead>{t('colComment')}</TableHead>
            <TableHead>{t('colStatus')}</TableHead>
            <TableHead className="text-right tabular-nums">{t('colDate')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                  <Inbox className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{tCommon('noData')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium text-slate-700 dark:text-slate-300">{lead.name}</TableCell>
                <TableCell className="text-slate-700 dark:text-slate-300">{lead.company}</TableCell>
                <TableCell>
                  <a href={`tel:${lead.phone}`} className="text-violet-600 hover:underline tabular-nums dark:text-violet-400">
                    {lead.phone}
                  </a>
                </TableCell>
                <TableCell className="max-w-xs truncate text-slate-500 dark:text-slate-400" title={lead.comment ?? undefined}>
                  {lead.comment || '—'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={saving === lead.id}
                      className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-50"
                    >
                      <StatusBadge label={t(`status.${lead.status}`)} tone={TONES[lead.status]} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {STATUSES.map((s) => (
                        <DropdownMenuItem key={s} onClick={() => setStatus(lead, s)}>
                          {t(`status.${s}`)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell className="text-right text-slate-500 dark:text-slate-400 tabular-nums">{formatDateTime(lead.created_at)}</TableCell>
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
          <span className="text-sm text-slate-500 dark:text-slate-400 px-2">
            {currentPage} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
            {tCommon('next')}
          </Button>
        </div>
      )}
    </div>
  )
}
