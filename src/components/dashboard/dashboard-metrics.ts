import { isoDate } from '@/lib/utils'

export const DASHBOARD_PERIODS = ['today', 'yesterday', 'week', 'month', 'all', 'custom'] as const
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number]

export interface PeriodChoice {
  period: DashboardPeriod
  start: string
  end: string
}

export interface SoldDay {
  order_date: string
  revenue: number
  cost: number
  orderCount: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const DAYS_BACK = { week: 7, month: 30 } as const

/** Whether a `YYYY-MM-DD` (or timestamp) falls inside the chosen period, measured from `now`. */
export function periodTest({ period, start, end }: PeriodChoice, now: Date) {
  const today = isoDate(now)
  const yesterday = isoDate(new Date(now.getTime() - DAY_MS))
  const from = start ? new Date(start) : null
  const to = end ? new Date(end) : null
  return (value?: string | null) => {
    if (period === 'all') return true
    if (!value) return false
    if (period === 'today') return value.split('T')[0] === today
    if (period === 'yesterday') return value.split('T')[0] === yesterday
    const date = new Date(value)
    if (period === 'custom') return (!from || date >= from) && (!to || date <= to)
    return date.getTime() >= now.getTime() - DAYS_BACK[period] * DAY_MS
  }
}

const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0)

/**
 * Sales are the sold lines (not income transactions, which also hold top-ups and debt
 * repayments); profit is revenue minus their cost; orders are counted per day, so never twice.
 */
export function periodMetrics(choice: PeriodChoice, now: Date, data: { soldDays: SoldDay[]; transactions: any[]; allTimeExpense: number }) {
  const inPeriod = periodTest(choice, now)
  const days = data.soldDays.filter((d) => inPeriod(d.order_date))
  const revenue = sum(days, (d) => d.revenue)
  const orders = sum(days, (d) => d.orderCount)
  const expenses = choice.period === 'all' ? data.allTimeExpense : sum(data.transactions.filter((tx) => tx.type === 'expense' && inPeriod(tx.transaction_date)), (tx) => tx.amount)
  const profit = revenue - sum(days, (d) => d.cost)
  return { revenue, expenses, profit, orders, avgCheck: orders > 0 ? revenue / orders : 0, margin: (profit / (revenue || 1)) * 100 }
}

export type DashboardMetrics = ReturnType<typeof periodMetrics>
