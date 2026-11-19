'use client'

import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { CustomDateRangePicker } from '@/components/shared/custom-date-range-picker'
import { DetailBanner, KpiGrid, KpiTile } from '@/components/shared/detail-page'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { EmployeeActivity } from './employee-activity'
import { exportEmployee, tenureMonths, totals } from './employee-figures'
import { AccessCard, PersonnelCard } from './employee-side-cards'
import { PERIOD_PRESETS, usePeriod, type Period, type PeriodState } from './use-period'

interface EmployeeDetailClientProps {
  lang: string
  employee: any
  transactions: any[]
  salesOrders: any[]
}

const PRESET_KEYS = { all: 'periodAll', today: 'periodToday', week: 'periodWeek', month: 'periodMonth' } as const

function PeriodBar({ period, lang }: { period: PeriodState; lang: string }) {
  const t = useTranslations('hr.detail')
  const options = PERIOD_PRESETS.map((value) => ({ value, label: t(PRESET_KEYS[value]) }))
  return (
    <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
      <SegmentedControl<Period>
        label={t('period')}
        value={period.period}
        onChange={period.setPeriod}
        options={options}
        className="w-full sm:w-auto"
      />
      <CustomDateRangePicker isActive={period.period === 'custom'} start={period.range.start} end={period.range.end} onApply={period.applyRange} lang={lang} />
    </div>
  )
}

function EmployeeBadges({ employee }: { employee: any }) {
  const t = useTranslations('hr')
  return (
    <>
      <StatusBadge tone={employee.is_active ? 'emerald' : 'rose'} pulse={employee.is_active} label={t(employee.is_active ? 'statusEmployed' : 'statusTerminated')} />
      <StatusBadge tone={employee.is_paid ? 'indigo' : 'slate'} label={t(employee.is_paid ? 'subscribed' : 'notSubscribed')} />
    </>
  )
}

export function EmployeeDetailClient({ lang, employee, transactions, salesOrders }: EmployeeDetailClientProps) {
  const t = useTranslations()
  const period = usePeriod()
  const payouts = transactions.filter((tx) => period.within(tx.transaction_date))
  const sales = salesOrders.filter((o) => period.within(o.order_date))
  const sum = totals(payouts, sales)
  const periodLabel = t(`hr.detail.${period.period === 'custom' ? 'periodCustom' : PRESET_KEYS[period.period]}`)
  const suffix = period.period === 'all' ? '' : ` · ${periodLabel}`
  return (
    <div className="space-y-6">
      <DetailBanner
        leading={
          <Avatar className="size-14">
            <AvatarFallback className="bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-400">{employee.full_name?.[0] ?? 'E'}</AvatarFallback>
          </Avatar>
        }
        title={employee.full_name ?? '—'}
        subtitle={`${employee.position ?? ''} • ${employee.profiles?.departments?.name ?? '—'}`}
        active={employee.is_active}
        badges={<EmployeeBadges employee={employee} />}
        onExport={() => exportEmployee(employee, transactions, salesOrders, t)}
      >
        <PeriodBar period={period} lang={lang} />
      </DetailBanner>
      <KpiGrid>
        <KpiTile label={t('hr.salary')} value={formatCurrency(employee.salary)}>{`${t('hr.employeeCode')}: ${employee.employee_code}`}</KpiTile>
        <KpiTile label={t('hr.detail.tenure')} value={t('hr.detail.tenureMonths', { count: tenureMonths(employee, period.now) })}>
          {`${t('hr.hiredAt')}: ${formatDate(employee.hired_at)}`}
        </KpiTile>
        <KpiTile label={t('hr.detail.processedSales')} value={formatCurrency(sum.sold)}>{`${sales.length} ${t('common.count')}${suffix}`}</KpiTile>
        <KpiTile label={t('hr.detail.paidOut')} value={formatCurrency(sum.paid)}>{`${payouts.length} ${t('common.count')}${suffix}`}</KpiTile>
      </KpiGrid>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 self-start">
          <PersonnelCard employee={employee} />
          <AccessCard profile={employee.profiles} />
        </div>
        <EmployeeActivity period={period} periodLabel={periodLabel} transactions={payouts} salesOrders={sales} paid={sum.paid} />
      </div>
    </div>
  )
}
