'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatPhoneInput } from '@/lib/tenant-auth'
import { cn } from '@/lib/utils'

export interface TenantRow {
  id: string
  subdomain: string
  company_name: string
  phone: string
  status: 'active' | 'blocked' | 'inactive'
  costing_method: string
  subscription_ends_at: string | null
  price_paid: number | null
}

const STATUS_TONE: Record<TenantRow['status'], StatusTone> = {
  active: 'emerald',
  blocked: 'rose',
  inactive: 'slate',
}

const ITEMS_PER_PAGE = 10

export function TenantsTable({
  tenants,
  initialStatus = 'all',
}: {
  tenants: TenantRow[]
  initialStatus?: 'all' | TenantRow['status']
}) {
  const t = useTranslations('admin.tenants')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TenantRow['status']>(initialStatus)
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = tenants.filter((tenant) => {
    if (statusFilter !== 'all' && tenant.status !== statusFilter) return false
    const q = search.toLowerCase()
    if (!q) return true
    return (
      tenant.company_name.toLowerCase().includes(q) ||
      tenant.subdomain.toLowerCase().includes(q) ||
      tenant.phone.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const statusFilters: { value: 'all' | TenantRow['status']; label: string }[] = [
    { value: 'all', label: t('filterAll') },
    { value: 'active', label: t('statusActive') },
    { value: 'blocked', label: t('statusBlocked') },
    { value: 'inactive', label: t('statusInactive') },
  ]

  const startItem = filtered.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)

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
            {statusFilters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setStatusFilter(f.value)
                  setCurrentPage(1)
                }}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
                  statusFilter === f.value
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-400 font-medium whitespace-nowrap">
            {t('showing', { start: startItem, end: endItem, total: filtered.length })}
          </span>
          <Button onClick={() => router.push('/admin/tenants/new')} className="gap-2 bg-indigo-600 hover:bg-indigo-500">
            <Plus className="h-4 w-4" /> {t('newTenant')}
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('colCompany')}</TableHead>
            <TableHead>{t('colSubdomain')}</TableHead>
            <TableHead>{t('colPhone')}</TableHead>
            <TableHead>{t('colStatus')}</TableHead>
            <TableHead>{t('colCosting')}</TableHead>
            <TableHead>{t('colSubscriptionEnds')}</TableHead>
            <TableHead>{t('colPricePaid')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((tenant) => (
              <TableRow
                key={tenant.id}
                className="cursor-pointer"
                onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
              >
                <TableCell className="font-medium">{tenant.company_name}</TableCell>
                <TableCell className="text-slate-500">{tenant.subdomain}</TableCell>
                <TableCell className="text-slate-500 tabular-nums">{formatPhoneInput(tenant.phone)}</TableCell>
                <TableCell>
                  <StatusBadge label={t(`status${capitalize(tenant.status)}`)} tone={STATUS_TONE[tenant.status]} />
                </TableCell>
                <TableCell className="uppercase text-slate-500">{tenant.costing_method}</TableCell>
                <TableCell className="text-slate-500">
                  {tenant.subscription_ends_at ? formatDate(tenant.subscription_ends_at) : '—'}
                </TableCell>
                <TableCell className="text-slate-500 tabular-nums">
                  {tenant.price_paid != null ? formatCurrency(tenant.price_paid) : '—'}
                </TableCell>
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
            {t('prev')}
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
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
