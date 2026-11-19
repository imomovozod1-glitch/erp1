'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MobileChip } from '@/components/shared/mobile-list'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/shared/responsive-table'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { formatPhoneInput } from '@/lib/tenant-auth'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

export interface TenantRow {
  id: string
  company_name: string
  subdomain: string
  phone: string
  status: 'active' | 'blocked' | 'inactive'
  costing_method: string
  subscription_ends_at: string | null
  price_paid: number | null
}

type StatusFilter = 'all' | TenantRow['status']

const STATUS_TONE: Record<TenantRow['status'], StatusTone> = { active: 'emerald', blocked: 'rose', inactive: 'slate' }
const PAGE_SIZE = 10

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const matches = (tenant: TenantRow, q: string) => [tenant.company_name, tenant.subdomain, tenant.phone].some((v) => v.toLowerCase().includes(q))

/** The whole list is loaded (a platform has few companies), so search, filter and paging happen here. */
function useTenantList(tenants: TenantRow[], initialStatus: StatusFilter) {
  const [search, setSearchState] = useState('')
  const [status, setStatusState] = useState<StatusFilter>(initialStatus)
  const [page, setPage] = useState(1)
  const q = search.toLowerCase()
  const filtered = tenants.filter((tenant) => (status === 'all' || tenant.status === status) && (!q || matches(tenant, q)))
  const offset = (page - 1) * PAGE_SIZE
  return {
    search,
    setSearch: (value: string) => (setSearchState(value), setPage(1)),
    status,
    setStatus: (value: StatusFilter) => (setStatusState(value), setPage(1)),
    page,
    setPage,
    filtered,
    rows: filtered.slice(offset, offset + PAGE_SIZE),
    offset,
    totalPages: Math.ceil(filtered.length / PAGE_SIZE),
  }
}

type TenantList = ReturnType<typeof useTenantList>

function Toolbar({ list }: { list: TenantList }) {
  const t = useTranslations('admin.tenants')
  const router = useRouter()
  const filters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('filterAll') },
    { value: 'active', label: t('statusActive') },
    { value: 'blocked', label: t('statusBlocked') },
  ]
  const total = list.filtered.length
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
      <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
        <div className="relative w-full md:w-64 md:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('searchPlaceholder')} value={list.search} onChange={(e) => list.setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="-mx-1 flex max-w-full items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] max-md:w-full">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => list.setStatus(f.value)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors md:py-1.5',
                list.status === f.value ? 'border-violet-600 bg-violet-600 text-white' : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex w-full items-center gap-3 md:w-auto">
        <span className="hidden text-xs font-medium whitespace-nowrap text-muted-foreground sm:inline">
          {t('showing', { start: total > 0 ? list.offset + 1 : 0, end: Math.min(list.offset + PAGE_SIZE, total), total })}
        </span>
        <Button onClick={() => router.push('/admin/tenants/new')} className="h-11 w-full gap-2 md:h-auto md:w-auto">
          <Plus className="size-4" /> {t('newTenant')}
        </Button>
      </div>
    </div>
  )
}

function Pager({ list }: { list: TenantList }) {
  const t = useTranslations('admin.tenants')
  if (list.totalPages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 border-t p-4">
      <Button variant="outline" size="sm" disabled={list.page === 1} onClick={() => list.setPage((p) => p - 1)}>
        {t('prev')}
      </Button>
      <span className="px-2 text-sm text-muted-foreground">
        {list.page} / {list.totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={list.page === list.totalPages} onClick={() => list.setPage((p) => p + 1)}>
        {t('next')}
      </Button>
    </div>
  )
}

interface TenantsTableProps {
  tenants: TenantRow[]
  initialStatus?: StatusFilter
  /** Companies whose host the platform does not serve yet; empty when unknown or a wildcard covers every host. */
  unregisteredSubdomains?: string[]
}

export function TenantsTable({ tenants, initialStatus = 'all', unregisteredSubdomains = [] }: TenantsTableProps) {
  const t = useTranslations('admin.tenants')
  const router = useRouter()
  const list = useTenantList(tenants, initialStatus)
  const unregistered = new Set(unregisteredSubdomains)
  const warn = (tenant: TenantRow) => unregistered.has(tenant.subdomain) && <AlertTriangle className="size-3.5 text-amber-500" aria-label={t('domainNotServed')} />
  const status = (tenant: TenantRow) => <StatusBadge label={t(`status${capitalize(tenant.status)}`)} tone={STATUS_TONE[tenant.status]} />
  const ends = (tenant: TenantRow) => (tenant.subscription_ends_at ? formatDate(tenant.subscription_ends_at) : '—')
  const paid = (tenant: TenantRow) => (tenant.price_paid != null ? formatCurrency(tenant.price_paid) : '—')
  const muted = (value: string) => <span className="text-muted-foreground">{value}</span>
  const columns: ResponsiveColumn<TenantRow>[] = [
    { key: 'company', header: t('colCompany'), cell: (tenant) => <span className="font-medium">{tenant.company_name}</span> },
    { key: 'subdomain', header: t('colSubdomain'), cell: (tenant) => <span className="inline-flex items-center gap-1.5 text-muted-foreground">{tenant.subdomain}{warn(tenant)}</span> },
    { key: 'phone', header: t('colPhone'), className: 'tabular-nums', cell: (tenant) => muted(formatPhoneInput(tenant.phone)) },
    { key: 'status', header: t('colStatus'), cell: status },
    { key: 'costing', header: t('colCosting'), className: 'uppercase', cell: (tenant) => muted(tenant.costing_method) },
    { key: 'ends', header: t('colSubscriptionEnds'), cell: (tenant) => muted(ends(tenant)) },
    { key: 'paid', header: t('colPricePaid'), className: 'tabular-nums', cell: (tenant) => muted(paid(tenant)) },
  ]
  return (
    <div className="rounded-xl border-0 bg-card shadow-sm transition-shadow duration-200 hover:shadow-md">
      <Toolbar list={list} />
      <ResponsiveTable
        rows={list.rows}
        rowKey={(tenant) => tenant.id}
        columns={columns}
        indexOffset={list.offset}
        onRowClick={(tenant) => router.push(`/admin/tenants/${tenant.id}`)}
        empty={<p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>}
        card={(tenant) => ({
          eyebrow: (
            <>
              <MobileChip>{tenant.subdomain}</MobileChip>
              {warn(tenant)}
            </>
          ),
          title: tenant.company_name,
          subtitle: formatPhoneInput(tenant.phone),
          status: status(tenant),
          stats: [
            { label: t('colSubscriptionEnds'), value: ends(tenant) },
            { label: t('colPricePaid'), value: paid(tenant), tone: 'brand' },
          ],
        })}
      />
      <Pager list={list} />
    </div>
  )
}
