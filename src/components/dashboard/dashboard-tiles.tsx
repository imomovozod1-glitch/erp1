'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, DollarSign, Layers, Package, ShoppingCart, Truck, Users, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCanFn } from '@/components/providers/permissions-provider'
import { cn, formatCurrency } from '@/lib/utils'
import type { DashboardMetrics } from './dashboard-metrics'

interface KpiTileProps {
  label: string
  value: string
  icon: LucideIcon
  /** Spans both columns on a phone, so the fifth tile does not sit alone. */
  wide?: boolean
  children: ReactNode
}

function KpiTile({ label, value, icon: Icon, wide, children }: KpiTileProps) {
  return (
    <div className={cn('group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5', wide && 'max-sm:col-span-2')}>
      <div aria-hidden="true" className="absolute top-0 right-0 size-24 translate-x-4 -translate-y-4 rounded-full bg-violet-100 opacity-60 transition-transform duration-300 group-hover:scale-110 dark:bg-violet-500/10" />
      <div className="relative flex size-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
        <Icon className="size-5" />
      </div>
      <p className="relative mt-3 text-sm font-medium text-muted-foreground">{label}</p>
      {/* `text-lg` on a phone, where two tiles share the width and a nine-digit sum must still fit. */}
      <h3 className="relative mt-0.5 text-lg font-extrabold tracking-tight break-words text-foreground tabular-nums sm:text-xl">{value}</h3>
      <div className="relative mt-3 flex items-center justify-between gap-1 text-xs text-muted-foreground tabular-nums">{children}</div>
    </div>
  )
}

// Money owed to us and money we owe: the one place on this screen where colour classifies.
function OwedSplit({ receivables, payables }: { receivables: number; payables: number }) {
  const t = useTranslations('dashboard')
  const side = (label: string, value: number, tone: string, right?: boolean) => (
    <div className={cn('flex min-w-0 flex-col', right && 'text-right')}>
      <span className="text-[9px] font-medium text-muted-foreground uppercase">{label}</span>
      <span className={cn('mt-0.5 font-bold', tone)}>{formatCurrency(value)}</span>
    </div>
  )
  return (
    <div className="flex w-full items-center justify-between gap-1 border-t pt-2 text-[11px]">
      {side(t('receivables'), receivables, 'text-emerald-600 dark:text-emerald-400')}
      {side(t('payables'), payables, 'text-rose-600 dark:text-rose-400', true)}
    </div>
  )
}

export interface DashboardTotals {
  cashbox: number
  warehouse: number
  receivables: number
  payables: number
  products: number
  lowStock: number
  showSales: boolean
}

export function KpiTiles({ metrics, totals }: { metrics: DashboardMetrics; totals: DashboardTotals }) {
  const t = useTranslations('dashboard')
  const can = useCanFn()
  const strong = 'font-semibold text-foreground'
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {totals.showSales && (
        <KpiTile label={t('sales')} value={formatCurrency(metrics.revenue)} icon={ShoppingCart}>
          <span>{t('ordersCountText', { count: metrics.orders })}</span>
          <span className={strong}>{t('averageCheckText', { amount: formatCurrency(metrics.avgCheck) })}</span>
        </KpiTile>
      )}
      {can('analytics', 'view') && (
        <KpiTile label={t('profit')} value={formatCurrency(metrics.profit)} icon={DollarSign}>
          <span className={strong}>{t('profitabilityText', { percentage: metrics.margin.toFixed(1) })}</span>
          {can('finance', 'view') && <span>{t('expenseText', { amount: formatCurrency(metrics.expenses) })}</span>}
        </KpiTile>
      )}
      {can('finance', 'view') && (
        <KpiTile label={t('cashBalance')} value={formatCurrency(totals.cashbox)} icon={Layers}>
          <OwedSplit receivables={totals.receivables} payables={totals.payables} />
        </KpiTile>
      )}
      {can('inventory', 'view') && (
        <KpiTile label={t('warehouseValue')} value={formatCurrency(totals.warehouse)} icon={Package}>
          <span>{t('productsCountText', { count: totals.products })}</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">{t('lowStockCountText', { count: totals.lowStock })}</span>
        </KpiTile>
      )}
      {totals.showSales && (
        <KpiTile wide label={t('soldOnCredit')} value={formatCurrency(totals.receivables)} icon={AlertTriangle}>
          <span>{t('expectedFromCustomers')}</span>
        </KpiTile>
      )}
    </div>
  )
}

function CountChip({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-xs font-semibold text-foreground">{text}</span>
    </div>
  )
}

/** Head counts; a null count means the server left a company-wide total out for an `own`-scoped user. */
export function CountChips({ customers, employees, suppliers }: { customers: number | null; employees: number | null; suppliers: number | null }) {
  const t = useTranslations('dashboard')
  const can = useCanFn()
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {can('customers', 'view') && customers !== null && <CountChip icon={Users} text={t('customersCountText', { count: customers })} />}
      {can('hr', 'view') && <CountChip icon={Users} text={t('employeesCountText', { count: employees ?? 0 })} />}
      {can('procurement', 'view') && <CountChip icon={Truck} text={t('suppliersCountText', { count: suppliers ?? 0 })} />}
    </div>
  )
}
