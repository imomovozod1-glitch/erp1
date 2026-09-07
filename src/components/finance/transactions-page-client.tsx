'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/shared/page-header'
import { PeriodFilter, type Period } from '@/components/shared/period-filter'
import { TransactionsTable } from '@/components/finance/transactions-table'
import { FinanceSummary } from '@/components/finance/finance-summary'

interface TransactionsPageClientProps {
  /** Current page of transactions — the server applied period, search and paging. */
  transactions: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
  /** Totals across the whole filtered range, not just this page. */
  totalIncome: number
  totalExpense: number
  period: Period
  customStart: string
  customEnd: string
}

/**
 * The period filter now writes to the URL instead of component state +
 * sessionStorage.
 *
 * It has to: the rows are paginated in Postgres, so changing the period means
 * re-running the query on the server. Keeping it in the URL also makes a
 * filtered view linkable and survive a refresh, which the sessionStorage
 * version could only approximate.
 */
export function TransactionsPageClient({
  transactions,
  lang,
  page,
  pageSize,
  total,
  totalPages,
  totalIncome,
  totalExpense,
  period,
  customStart,
  customEnd,
}: TransactionsPageClientProps) {
  const t = useTranslations('finance')
  const tInfo = useTranslations('pageInfo')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handlePeriodChange = (next: Period) => {
    // Changing the filter always returns to page 1 — page 4 of the old result
    // set is meaningless against the new one.
    setParams({ period: next === 'all' ? null : next, page: null, from: null, to: null })
  }

  const handleApplyCustomRange = (start: string, end: string) => {
    setParams({ period: 'custom', from: start || null, to: end || null, page: null })
  }

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
      <FinanceSummary totalIncome={totalIncome} totalExpenses={totalExpense} />
      <TransactionsTable
        transactions={transactions}
        lang={lang}
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
      />
    </div>
  )
}
