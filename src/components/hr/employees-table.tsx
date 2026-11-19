'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCan } from '@/components/providers/permissions-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MobileChip, MobileThumb } from '@/components/shared/mobile-list'
import { PagedListCard, type PageInfo } from '@/components/shared/paged-list-card'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/shared/responsive-table'
import { RowActionsMenu } from '@/components/shared/row-actions-menu'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableFilterSelect } from '@/components/shared/table-pagination'
import { EmployeeImportExport } from '@/components/hr/employee-import-export'
import { formatCurrency, formatDate } from '@/lib/utils'

interface EmployeesTableProps extends PageInfo {
  employees: any[]
  lang: string
  status: 'all' | 'hired' | 'not_hired'
  paid: 'all' | 'paid' | 'free'
  canExport?: boolean
}

function EmployeeFilters({ status, paid }: Pick<EmployeesTableProps, 'status' | 'paid'>) {
  const t = useTranslations()
  return (
    <>
      <TableFilterSelect
        param="status"
        label={t('common.status')}
        value={status}
        options={[
          { value: 'all', label: t('common.all') },
          { value: 'hired', label: t('hr.statusEmployed') },
          { value: 'not_hired', label: t('hr.statusNotEmployed') },
        ]}
      />
      <TableFilterSelect
        param="paid"
        label={t('hr.subscription')}
        value={paid}
        options={[
          { value: 'all', label: t('common.all') },
          { value: 'paid', label: t('hr.subscribed') },
          { value: 'free', label: t('hr.notSubscribed') },
        ]}
      />
    </>
  )
}

function NameCell({ emp, href }: { emp: any; href: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-8">
        <AvatarFallback className="bg-violet-100 text-xs text-violet-700 dark:bg-violet-950/50 dark:text-violet-400">{emp.full_name?.[0] ?? 'E'}</AvatarFallback>
      </Avatar>
      <Link href={href} onClick={(e) => e.stopPropagation()} className="font-semibold text-foreground transition-colors hover:text-violet-600 dark:hover:text-violet-400">
        {emp.full_name ?? '—'}
      </Link>
    </div>
  )
}

function useEmployeeBadges() {
  const t = useTranslations('hr')
  return {
    employed: (emp: any) => <StatusBadge tone={emp.is_active ? 'emerald' : 'rose'} pulse={emp.is_active} label={t(emp.is_active ? 'statusEmployed' : 'statusTerminated')} />,
    seat: (emp: any) => <StatusBadge tone={emp.is_paid ? 'indigo' : 'slate'} label={t(emp.is_paid ? 'subscribed' : 'notSubscribed')} />,
  }
}

export function EmployeesTable({ employees, lang, status, paid, canExport = false, ...pageInfo }: EmployeesTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const canEdit = useCan('hr', 'edit', 'employees')
  const badges = useEmployeeBadges()
  const detailUrl = (emp: any) => `/${lang}/hr/employees/${emp.id}`
  const menu = (emp: any) => (
    <RowActionsMenu actions={[{ key: 'edit', label: t('common.edit'), icon: Pencil, href: `${detailUrl(emp)}/edit`, hidden: !canEdit }]} />
  )
  const roleOf = (emp: any) => emp.profiles?.role_templates?.name ?? (emp.profiles?.role ? t(`settings.role.${emp.profiles.role}`) : '—')
  const columns: ResponsiveColumn<any>[] = [
    { key: 'name', header: t('common.name'), cell: (emp) => <NameCell emp={emp} href={detailUrl(emp)} /> },
    { key: 'phone', header: t('hr.phoneNumber'), className: 'whitespace-nowrap tabular-nums', cell: (emp) => emp.profiles?.phone || '—' },
    { key: 'role', header: t('hr.roles'), cell: roleOf },
    { key: 'code', header: t('hr.employeeCode'), className: 'max-lg:hidden', cell: (emp) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{emp.employee_code}</code> },
    { key: 'position', header: t('hr.position'), cell: (emp) => emp.position || '—' },
    { key: 'salary', header: t('hr.salary'), align: 'right', cell: (emp) => <span className="font-semibold">{formatCurrency(emp.salary)}</span> },
    { key: 'hired', header: t('hr.hiredAt'), cell: (emp) => <span className="text-muted-foreground">{formatDate(emp.hired_at)}</span> },
    { key: 'status', header: t('common.status'), cell: badges.employed },
    { key: 'seat', header: t('hr.subscription'), cell: badges.seat },
    { key: 'menu', header: '', className: 'w-12', isolated: true, cell: menu },
  ]
  return (
    <PagedListCard
      pageInfo={pageInfo}
      filters={<EmployeeFilters status={status} paid={paid} />}
      tools={canExport && <EmployeeImportExport employees={employees} lang={lang} />}
    >
      <ResponsiveTable
        rows={employees}
        rowKey={(emp) => emp.id}
        columns={columns}
        indexOffset={(pageInfo.page - 1) * pageInfo.pageSize}
        onRowClick={(emp) => router.push(detailUrl(emp))}
        empty={
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Users className="size-8 opacity-40" />
            <p className="text-sm">{t('common.noData')}</p>
          </div>
        }
        card={(emp) => ({
          leading: <MobileThumb fallback={<Users />} />,
          eyebrow: (
            <>
              {emp.employee_code && <MobileChip>{emp.employee_code}</MobileChip>}
              {emp.position && <span className="truncate">{emp.position}</span>}
            </>
          ),
          title: emp.full_name ?? '—',
          subtitle: emp.profiles?.phone || undefined,
          status: badges.employed(emp),
          menu: menu(emp),
          stats: [
            { label: t('hr.salary'), value: formatCurrency(emp.salary), tone: 'brand' },
            { label: t('hr.hiredAt'), value: formatDate(emp.hired_at) },
            { label: t('hr.subscription'), value: t(emp.is_paid ? 'hr.subscribed' : 'hr.notSubscribed'), tone: emp.is_paid ? 'good' : 'default' },
          ],
        })}
      />
    </PagedListCard>
  )
}
