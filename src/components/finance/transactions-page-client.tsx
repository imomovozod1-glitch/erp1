'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/shared/page-header'
import { PeriodFilter, type Period } from '@/components/shared/period-filter'
import { TransactionsTable } from '@/components/finance/transactions-table'
import { FinanceSummary } from '@/components/finance/finance-summary'

interface TransactionsPageClientProps {
   
  transactions: any[]
  lang: string
}

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function TransactionsPageClient({ transactions, lang }: TransactionsPageClientProps) {
  const t = useTranslations('finance')
  const tInfo = useTranslations('pageInfo')

  const [period, setPeriod] = useState<Period>(() => {
    try {
      const saved = sessionStorage.getItem('transactions_period')
      return (saved as Period) || 'all'
    } catch {
      return 'all'
    }
  })
  const [customStart, setCustomStart] = useState<string>(() => {
    try {
      return sessionStorage.getItem('transactions_custom_start') || ''
    } catch {
      return ''
    }
  })
  const [customEnd, setCustomEnd] = useState<string>(() => {
    try {
      return sessionStorage.getItem('transactions_custom_end') || ''
    } catch {
      return ''
    }
  })

  const handlePeriodChange = (next: Period) => {
    setPeriod(next)
    try {
      sessionStorage.setItem('transactions_period', next)
    } catch {
      // sessionStorage unavailable — filter still works for this render
    }
  }

  const handleApplyCustomRange = (start: string, end: string) => {
    setPeriod('custom')
    setCustomStart(start)
    setCustomEnd(end)
    try {
      sessionStorage.setItem('transactions_period', 'custom')
      sessionStorage.setItem('transactions_custom_start', start)
      sessionStorage.setItem('transactions_custom_end', end)
    } catch {
      // sessionStorage unavailable — filter still works for this render
    }
  }

  const now = new Date()
  const todayStr = formatDateISO(now)
  const yesterdayStr = formatDateISO(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const customStartDate = customStart ? new Date(customStart) : null
  const customEndDate = customEnd ? new Date(customEnd) : null

   
  const filtered = transactions.filter((tx: any) => {
    const d = new Date(tx.created_at)
    if (period === 'today') return formatDateISO(d) === todayStr
    if (period === 'yesterday') return formatDateISO(d) === yesterdayStr
    if (period === 'week') return d >= weekAgo
    if (period === 'month') return d >= monthAgo
    if (period === 'custom') {
      return (!customStartDate || d >= customStartDate) && (!customEndDate || d <= customEndDate)
    }
    return true
  })

   
  const totalIncome = filtered.filter((tx: any) => tx.type === 'income').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
   
  const totalExpenses = filtered.filter((tx: any) => tx.type === 'expense').reduce((s: number, tx: any) => s + Number(tx.amount), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('transactions')}
        subtitle={t('title')}
        info={tInfo('transactions')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('transactions') },
        ]}
      >
        <PeriodFilter
          period={period}
          onPeriodChange={handlePeriodChange}
          customStart={customStart}
          customEnd={customEnd}
          onApplyCustomRange={handleApplyCustomRange}
        />
      </PageHeader>
      <FinanceSummary totalIncome={totalIncome} totalExpenses={totalExpenses} />
      <TransactionsTable transactions={filtered} lang={lang} />
    </div>
  )
}
