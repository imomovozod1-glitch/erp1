'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useCan } from '@/components/providers/permissions-provider'
import { PageInfoButton } from '@/components/shared/page-info-button'
import { PeriodFilter } from '@/components/shared/period-filter'
import { periodMetrics, type DashboardPeriod, type SoldDay } from './dashboard-metrics'
import { CountChips, KpiTiles } from './dashboard-tiles'
import { QuickActions } from './quick-actions'
import { useDashboardPeriod } from './use-dashboard-period'

interface DashboardClientProps {
  lang: string
  /** Server-rendered "your support manager" strip; null when none is assigned. */
  agentCard?: ReactNode
  stats: {
    totalOrders: number | null
    totalProducts: number | null
    totalCustomers: number | null
    totalEmployees: number | null
    totalSuppliers: number | null
    recentOrders: any[]
    chartTxData: any[]
    allTimeExpense: number
    lowStockRows: any[]
    pendingInvoices: number | null
    totalCashboxBalance?: number
    warehouseValue?: number
    totalReceivables?: number
    totalPayables?: number
    /** One row per day the company sold anything — see getCachedDashboardStats. */
    soldDays?: SoldDay[]
  }
}

const LOW_STOCK_SHOWN = 5

function DashboardBar({ lang, state }: { lang: string; state: ReturnType<typeof useDashboardPeriod> }) {
  const t = useTranslations()
  const { choice } = state
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none sm:flex-row sm:items-center">
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground max-md:hidden">
        {t('dashboard.title')}
        <PageInfoButton text={t('pageInfo.dashboard')} />
      </h1>
      <PeriodFilter
        period={choice.period}
        onPeriodChange={(next) => state.setPeriod(next as DashboardPeriod)}
        customStart={choice.start}
        customEnd={choice.end}
        onApplyCustomRange={state.applyRange}
        lang={lang}
      />
    </div>
  )
}

/** The money tiles show what the server computed; the period only re-slices the day rows it sent. */
export function DashboardClient({ lang, stats, agentCard }: DashboardClientProps) {
  const period = useDashboardPeriod()
  const canSeeSales = useCan('sales', 'view') && stats.totalOrders !== null
  const metrics = periodMetrics(period.choice, period.now, { soldDays: stats.soldDays ?? [], transactions: stats.chartTxData, allTimeExpense: stats.allTimeExpense })
  const lowStock = (stats.lowStockRows ?? []).filter((p) => p.stock < p.min_stock).slice(0, LOW_STOCK_SHOWN)
  const totals = {
    cashbox: stats.totalCashboxBalance ?? 0,
    warehouse: stats.warehouseValue ?? 0,
    receivables: stats.totalReceivables ?? 0,
    payables: stats.totalPayables ?? 0,
    products: stats.totalProducts ?? 0,
    lowStock: lowStock.length,
    showSales: canSeeSales,
  }
  return (
    <div className="space-y-6">
      <DashboardBar lang={lang} state={period} />
      {agentCard}
      <QuickActions lang={lang} />
      <KpiTiles metrics={metrics} totals={totals} />
      <CountChips customers={stats.totalCustomers} employees={stats.totalEmployees} suppliers={stats.totalSuppliers} />
    </div>
  )
}
