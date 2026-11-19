import { formatCurrency } from '@/lib/utils'

type Translate = (key: string, values?: Record<string, string | number>) => string

export interface CashboxShortfall {
  cashboxName?: string | null
  balance?: number | null
  amount?: number | null
}

export const insufficientCashboxMessage = (t: Translate, details: CashboxShortfall) =>
  t('sales.cancelSaleInsufficient', {
    cashbox: details.cashboxName ?? '—',
    balance: formatCurrency(details.balance ?? 0),
    amount: formatCurrency(details.amount ?? 0),
  })
