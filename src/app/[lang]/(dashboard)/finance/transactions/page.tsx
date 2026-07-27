import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionsTable } from '@/components/finance/transactions-table'
import { FinanceSummary } from '@/components/finance/finance-summary'
import { getCachedTransactions } from '@/lib/data/queries'

export const revalidate = 30

export const metadata: Metadata = { title: 'Finance' }

export default async function TransactionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations('finance')
  const transactions = await getCachedTransactions()

  const totalIncome = transactions
    .filter((t: any) => t.type === 'income')
    .reduce((s: number, t: any) => s + t.amount, 0)
  
  const totalExpenses = transactions
    .filter((t: any) => t.type === 'expense')
    .reduce((s: number, t: any) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('transactions')}
        subtitle={t('title')}
        action={{ label: t('addTransaction'), href: `/${lang}/finance/transactions/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('transactions') },
        ]}
      />
      <FinanceSummary totalIncome={totalIncome} totalExpenses={totalExpenses} />
      <TransactionsTable transactions={transactions} lang={lang} />
    </div>
  )
}
