import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { TransactionsTable } from '@/components/finance/transactions-table'
import { getCachedTransactions } from '@/lib/data/queries'

export const revalidate = 30

export const metadata: Metadata = { title: 'Income' }

export default async function IncomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations('finance')
  const transactions = await getCachedTransactions()

  const incomeTransactions = transactions.filter((t: any) => t.type === 'income')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('income')}
        subtitle={t('title')}
        action={{ label: t('addTransaction'), href: `/${lang}/finance/income/new`, icon: Plus }}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('income') },
        ]}
      />
      <TransactionsTable transactions={incomeTransactions} lang={lang} />
    </div>
  )
}
