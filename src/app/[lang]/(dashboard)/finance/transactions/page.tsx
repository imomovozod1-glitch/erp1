import type { Metadata } from 'next'
import { TransactionsPageClient } from '@/components/finance/transactions-page-client'
import { getCachedTransactions } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'

export const revalidate = 30

export const metadata: Metadata = { title: 'Finance' }

export default async function TransactionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId() as string
  const transactions = await getCachedTransactions(tenantId)

  return <TransactionsPageClient transactions={transactions} lang={lang} />
}
