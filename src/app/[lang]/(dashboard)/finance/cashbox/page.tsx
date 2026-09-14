import type { Metadata } from 'next'
import { CashboxClient } from '@/components/finance/cashbox-client'
import { getCachedCashboxPageData, getCachedCashboxTransactions } from '@/lib/data/queries'
import { resolvePeriodDays, type PeriodKey } from '@/lib/data/paginate'
import { getCurrentTenantId } from '@/lib/tenant'

export const metadata: Metadata = { title: 'Cashbox' }

const PERIODS: PeriodKey[] = ['today', 'yesterday', 'week', 'month', 'custom', 'all']

export default async function CashboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  // The period lives in the URL, like the transactions list: the history is
  // filtered in Postgres now, so the range has to be known before the query
  // runs rather than applied to an already-downloaded array afterwards.
  //
  // Opens on the last 30 days rather than on "all": with the history no longer
  // sliced in the browser, the default is also the default QUERY, and an
  // unbounded one would still hand every cashbox transaction the tenant has
  // ever written to a screen showing this month's. "Hammasi" is one click away.
  const periodParam = one(sp.period) as PeriodKey | undefined
  const period: PeriodKey = periodParam && PERIODS.includes(periodParam) ? periodParam : 'month'
  const customStart = one(sp.from) ?? ''
  const customEnd = one(sp.to) ?? ''
  const range = resolvePeriodDays(period, customStart, customEnd)

  const tenantId = (await getCurrentTenantId()) as string
  // Both reads are cached and independent — switching the period only misses
  // the second one.
  const [data, transactions] = await Promise.all([
    getCachedCashboxPageData(tenantId),
    getCachedCashboxTransactions(tenantId, range.from, range.to),
  ])

  return (
    <CashboxClient
      lang={lang}
      initialData={{ ...data, transactions }}
      period={period}
      customStart={customStart}
      customEnd={customEnd}
    />
  )
}
