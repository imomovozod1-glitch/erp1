'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Search, Wallet } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'

export interface AdminPaymentRow {
  id: string
  amount: number
  paid_at: string
  note: string | null
  tenant_id: string
  tenant_company_name: string
  tenant_subdomain: string
}

const ITEMS_PER_PAGE = 10

export function AdminPaymentsTable({ payments }: { payments: AdminPaymentRow[] }) {
  const t = useTranslations('admin.payments')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      p.tenant_company_name.toLowerCase().includes(q) ||
      p.tenant_subdomain.toLowerCase().includes(q) ||
      (p.note ?? '').toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const startItem = filtered.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)

  return (
    <div className="rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 dark:border-slate-800">
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
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
          {t('showing', { start: startItem, end: endItem, total: filtered.length })}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('colTenant')}</TableHead>
            <TableHead>{t('colAmount')}</TableHead>
            <TableHead>{t('colNote')}</TableHead>
            <TableHead className="text-right">{t('colDate')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Wallet className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t('empty')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => router.push(`/admin/tenants/${p.tenant_id}`)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                      {getInitials(p.tenant_company_name)}
                    </div>
                    <div>
                      <p>{p.tenant_company_name}</p>
                      <p className="text-xs text-slate-400 font-normal">{p.tenant_subdomain}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(p.amount)}
                </TableCell>
                <TableCell className="text-slate-500">{p.note || '—'}</TableCell>
                <TableCell className="text-right text-slate-500">{formatDate(p.paid_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t p-4 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
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
