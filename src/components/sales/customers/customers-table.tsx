'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { MapPin, Pencil, Trash2, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useCan } from '@/components/providers/permissions-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { MobileChip, MobileThumb } from '@/components/shared/mobile-list'
import { PagedListCard, type PageInfo } from '@/components/shared/paged-list-card'
import { ResponsiveTable } from '@/components/shared/responsive-table'
import { RowActionsMenu } from '@/components/shared/row-actions-menu'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableFilterChips } from '@/components/shared/table-pagination'
import { CustomerImportExport } from '@/components/sales/customer-import-export'
import { EmptyCatalog } from '@/components/inventory/catalog/catalog-parts'
import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { cn, formatCurrency } from '@/lib/utils'

const LocationMapDialog = dynamic(() => import('@/components/shared/location-map-dialog').then((m) => m.LocationMapDialog), {
  ssr: false,
})

interface CustomersTableProps extends PageInfo {
  customers: any[]
  balance: string
  lang: string
  canExport?: boolean
}

const netBalance = (customer: any) => (Number(customer.credit_balance) || 0) - (Number(customer.total_debt) || 0)
const signedBalance = (net: number) => (net === 0 ? formatCurrency(0) : `${net > 0 ? '+' : '-'}${formatCurrency(Math.abs(net))}`)
const hasLocation = (customer: any) => !!(customer.address || (customer.latitude && customer.longitude))

function useCustomerDelete() {
  const t = useTranslations()
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const [busyId, setBusyId] = useState<string | null>(null)
  const remove = async (customer: any) => {
    if (!(await confirmDelete({ name: customer.name }))) return
    setBusyId(customer.id)
    const { error } = await createClient().from('customers').delete().eq('id', customer.id)
    setBusyId(null)
    if (error) return void toast.error(t(error.code === '23503' ? 'sales.cannotDeleteCustomer' : 'common.error'))
    toast.success(t('common.success'))
    await invalidateCustomers()
  }
  return { busyId, remove, confirmDialog }
}

export function CustomersTable({ balance, canExport = false, customers, lang, ...pageInfo }: CustomersTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const canEdit = useCan('customers', 'edit', 'list')
  const canDelete = useCan('customers', 'delete', 'list')
  const deletion = useCustomerDelete()
  const [mapCustomer, setMapCustomer] = useState<any | null>(null)
  const status = (c: any) => <StatusBadge tone={c.is_active ? 'emerald' : 'slate'} label={t(c.is_active ? 'common.active' : 'common.inactive')} />
  const assignee = (c: any) => c.assignee?.full_name || t('common.unassigned')
  const menu = (c: any) => (
    <RowActionsMenu
      actions={[
        { key: 'edit', label: t('common.edit'), icon: Pencil, href: `/${lang}/customers/${c.id}/edit`, hidden: !canEdit },
        { key: 'map', label: t('sales.viewOnMap'), icon: MapPin, onClick: () => setMapCustomer(c), hidden: !hasLocation(c) },
        { key: 'delete', label: t('common.delete'), icon: Trash2, onClick: () => deletion.remove(c), disabled: deletion.busyId === c.id, destructive: true, hidden: !canDelete },
      ]}
    />
  )
  const balanceFilters = ['all', 'debtor', 'creditor', 'zero'].map((value) => ({
    value,
    label: value === 'all' ? t('common.all') : t(`sales.balance${value === 'debtor' ? 'Debtors' : value === 'creditor' ? 'Creditors' : 'Zero'}`),
  }))

  return (
    <>
      <PagedListCard
        pageInfo={pageInfo}
        filters={<TableFilterChips param="balance" value={balance} options={balanceFilters} />}
        tools={canExport && <CustomerImportExport customers={customers} lang={lang} />}
      >
        <ResponsiveTable
          rows={customers}
          rowKey={(c) => c.id}
          indexOffset={(pageInfo.page - 1) * pageInfo.pageSize}
          onRowClick={(c) => router.push(`/${lang}/customers/${c.id}`)}
          empty={<EmptyCatalog icon={Users} />}
          columns={[
            { key: 'name', header: t('common.name'), cell: (c) => <CustomerName customer={c} /> },
            { key: 'email', header: t('common.email'), className: 'text-muted-foreground', cell: (c) => c.email ?? '—' },
            { key: 'phone', header: t('common.phone'), className: 'text-muted-foreground', cell: (c) => c.phone ?? '—' },
            { key: 'category', header: t('sales.category'), className: 'text-muted-foreground', cell: (c) => c.customer_categories?.name ?? '—' },
            { key: 'balance', header: t('sales.balanceRemaining'), align: 'right', className: 'tabular-nums', cell: (c) => <BalanceText net={netBalance(c)} /> },
            { key: 'status', header: t('common.status'), cell: status },
            { key: 'assignee', header: t('common.assignedTo'), className: 'text-muted-foreground max-lg:hidden', cell: assignee },
            { key: 'menu', header: '', className: 'w-12', isolated: true, cell: menu },
          ]}
          card={(c) => {
            const net = netBalance(c)
            return {
              leading: <MobileThumb fallback={<Users />} />,
              eyebrow: (
                <>
                  <MobileChip>{c.phone ?? '—'}</MobileChip>
                  {c.customer_categories?.name && <span className="truncate">{c.customer_categories.name}</span>}
                </>
              ),
              title: c.name,
              status: status(c),
              menu: menu(c),
              stats: [
                { label: t('sales.balanceRemaining'), value: signedBalance(net), tone: net === 0 ? 'default' : net > 0 ? 'good' : 'bad' },
                { label: t('common.assignedTo'), value: assignee(c) },
              ],
            }
          }}
        />
      </PagedListCard>
      {mapCustomer && (
        <LocationMapDialog
          open
          onOpenChange={(open) => !open && setMapCustomer(null)}
          address={mapCustomer.address}
          latitude={mapCustomer.latitude}
          longitude={mapCustomer.longitude}
          title={mapCustomer.name}
          lang={lang}
        />
      )}
      {deletion.confirmDialog}
    </>
  )
}

function CustomerName({ customer }: { customer: any }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-8">
        <AvatarFallback className="bg-violet-100 text-xs text-violet-700 dark:bg-violet-950/50 dark:text-violet-400">{customer.name[0]}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-foreground">{customer.name}</span>
    </div>
  )
}

function BalanceText({ net }: { net: number }) {
  return (
    <span className={cn(net === 0 ? 'text-muted-foreground' : 'font-semibold', net > 0 && 'text-emerald-600 dark:text-emerald-400', net < 0 && 'text-rose-600 dark:text-rose-400')}>
      {signedBalance(net)}
    </span>
  )
}
