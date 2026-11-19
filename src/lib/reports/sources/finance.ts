import 'server-only'
import { fetchRows, reportClient, matchesSearch, periodKey, present, toNumber, type ReportView, type Runner } from '@/lib/reports/engine-core'

const MONEY_COLUMNS = { income: 'money', expense: 'money', net: 'money' } as const
const BY_PERIOD: ReportView = { columns: { period: 'text', ...MONEY_COLUMNS }, by: ['period'], order: { asc: 'period' } }

const VIEWS: Record<string, ReportView> = {
  day: BY_PERIOD,
  month: BY_PERIOD,
  category: { columns: { category: 'text', ...MONEY_COLUMNS }, by: ['category'], order: { descAbs: 'net' } },
  type: { columns: { type: 'text', ...MONEY_COLUMNS }, by: ['type'] },
  none: { columns: { date: 'date', type: 'text', category: 'text', description: 'text', income: 'money', expense: 'money' }, order: { desc: 'date' } },
}

export const runFinance: Runner = async (ctx, req) => {
  let query = reportClient()
    .from('transactions')
    .select('type, amount, category, description, transaction_date, assigned_to')
    .eq('tenant_id', ctx.tenantId)
  if (req.from) query = query.gte('transaction_date', req.from)
  if (req.to) query = query.lte('transaction_date', req.to)
  if (ctx.ownerId) query = query.or(`assigned_to.eq.${ctx.ownerId},assigned_to.is.null`)
  const rows = (await fetchRows(query))
    .filter((row) => matchesSearch(req.search, row.category, row.description))
    .map((row) => {
      const amount = toNumber(row.amount)
      const income = row.type === 'income'
      return {
        date: row.transaction_date ?? null,
        period: periodKey(row.transaction_date, req.groupBy),
        type: row.type,
        category: row.category ?? '—',
        description: row.description ?? '',
        income: income ? amount : 0,
        expense: row.type === 'expense' ? amount : 0,
        net: income ? amount : -amount,
      }
    })
  return present(rows, VIEWS, req.groupBy, ['income', 'expense', 'net'])
}
