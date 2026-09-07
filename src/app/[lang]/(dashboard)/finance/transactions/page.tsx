import type { Metadata } from 'next'
import { TransactionsPageClient } from '@/components/finance/transactions-page-client'
import { getTransactionsPage } from '@/lib/data/queries'
import { readPageParams, resolvePeriodRange, type PeriodKey } from '@/lib/data/paginate'
import { getDataScope, getPermissionContext } from '@/lib/permissions-server'
import { getCurrentTenantId } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Finance' }

const PERIODS: PeriodKey[] = ['today', 'yesterday', 'week', 'month', 'custom', 'all']

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  const { page, pageSize, search } = readPageParams(sp)
  // With the `own` data scope this list is limited to the records this user
  // is responsible for (plus unassigned ones) — applied in the query.
  const [scope, permCtx] = await Promise.all([getDataScope('finance'), getPermissionContext()])
  const ownerId = scope === 'own' ? permCtx?.userId : undefined
  // The period moved from component state into the URL: with the list paged in
  // Postgres, the date range has to be resolved before the query runs, not
  // applied to an already-downloaded array afterwards.
  const periodParam = one(sp.period) as PeriodKey | undefined
  const period: PeriodKey = periodParam && PERIODS.includes(periodParam) ? periodParam : 'all'
  const customStart = one(sp.from) ?? ''
  const customEnd = one(sp.to) ?? ''
  const range = resolvePeriodRange(period, customStart, customEnd)

  const tenantId = (await getCurrentTenantId()) as string
  const result = await getTransactionsPage(tenantId, { page, pageSize, search, ...range, ownerId })

  return (
    <TransactionsPageClient
      transactions={result.rows}
      lang={lang}
      page={result.page}
      pageSize={result.pageSize}
      total={result.total}
      totalPages={result.totalPages}
      totalIncome={result.totalIncome}
      totalExpense={result.totalExpense}
      period={period}
      customStart={customStart}
      customEnd={customEnd}
    />
  )
}
