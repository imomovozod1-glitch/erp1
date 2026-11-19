import { PERMISSION_MODULES, allPermissions, normalisePermissions } from '@/lib/permissions'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { downloadWorkbook } from '@/components/shared/detail-page'

type Translate = (key: string, values?: Record<string, string | number>) => string

const DAY_MS = 24 * 60 * 60 * 1000
const sum = (rows: any[], field: string) => rows.reduce((total, row) => total + (row[field] || 0), 0)

export function tenureMonths(employee: any, now: Date) {
  const end = employee.is_active ? now : new Date(employee.terminated_at || now)
  const days = Math.ceil(Math.abs(end.getTime() - new Date(employee.hired_at).getTime()) / DAY_MS)
  return Math.floor(days / 30)
}

export const totals = (transactions: any[], salesOrders: any[]) => ({
  paid: sum(transactions, 'amount'),
  sold: sum(salesOrders, 'total_amount'),
})

/** Modules the linked login can open; an admin passes every check, so their matrix is shown as full. */
export function grantedModules(profile: any) {
  if (!profile) return []
  const permissions = profile.role === 'admin' ? allPermissions() : normalisePermissions(profile.permissions)
  return PERMISSION_MODULES.flatMap((module) => (permissions[module]?.view ? [{ module, perm: permissions[module] }] : []))
}

function profileRows(employee: any, t: Translate) {
  const rows: [string, unknown][] = [
    [t('common.name'), employee.full_name ?? '—'],
    [t('hr.phoneNumber'), employee.profiles?.phone ?? '—'],
    [t('hr.employeeCode'), employee.employee_code],
    [t('hr.position'), employee.position],
    [t('hr.department'), employee.profiles?.departments?.name ?? '—'],
    [t('hr.salary'), formatCurrency(employee.salary)],
    [t('hr.hiredAt'), formatDate(employee.hired_at)],
    [t('hr.subscription'), t(employee.is_paid ? 'hr.subscribed' : 'hr.notSubscribed')],
    [t('common.status'), t(employee.is_active ? 'hr.statusEmployed' : 'hr.statusTerminated')],
  ]
  if (!employee.is_active && employee.terminated_at) rows.push([t('hr.terminatedAt'), formatDate(employee.terminated_at)])
  return rows.map(([name, value]) => ({ [t('hr.detail.colParameter')]: name, [t('hr.detail.colValue')]: value }))
}

export function exportEmployee(employee: any, transactions: any[], salesOrders: any[], t: Translate) {
  const payouts = transactions.map((tx) => ({
    [t('common.category')]: tx.category,
    [t('common.amount')]: tx.amount,
    [t('common.description')]: tx.description || '—',
    [t('common.date')]: formatDateTime(tx.created_at),
  }))
  const sales = salesOrders.map((o) => ({
    [t('hr.detail.saleCode')]: o.order_number,
    [t('sales.customer')]: o.customers?.name ?? '—',
    [t('common.totalAmount')]: o.total_amount,
    [t('common.status')]: t(`sales.status.${o.status}`),
    [t('common.date')]: formatDateTime(o.created_at),
  }))
  return downloadWorkbook(`${(employee.full_name ?? 'employee').replace(/\s+/g, '_')}_details.xlsx`, [
    { name: t('hr.detail.sheetProfile'), rows: profileRows(employee, t) },
    { name: t('hr.detail.payoutHistory'), rows: payouts },
    { name: t('hr.detail.processedSales'), rows: sales },
  ])
}
