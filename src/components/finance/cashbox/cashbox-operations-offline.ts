import { isoDate } from '@/lib/utils'
import { balanceAfter, movementRow, type MovementInput } from './cashbox-movement'
import { readMirror, writeMirror } from './cashbox-mirror'
import type { SettleInput } from './cashbox-operations'
import { isOpenInvoiceOf, outstandingOf } from './invoice-balance'

const dueTime = (invoice: any) => new Date(invoice.due_at || invoice.created_at).getTime()

function payInvoiceLocally(invoice: any, remaining: number, paidAt: string): number {
  const outstanding = outstandingOf(invoice)
  if (remaining < outstanding) {
    invoice.paid_amount = (Number(invoice.paid_amount) || 0) + remaining
    return 0
  }
  Object.assign(invoice, { paid_amount: invoice.total_amount, status: 'paid', paid_at: paidAt })
  return remaining - outstanding
}

function addCreditLocally(customerId: string, amount: number) {
  const customers = readMirror<any[]>('erp_customers', [])
  const customer = customers.find((c) => c.id === customerId)
  if (!customer) return
  customer.credit_balance = (Number(customer.credit_balance) || 0) + amount
  writeMirror('erp_customers', customers)
}

export function settleCustomerDebtOffline({ customerId, amount, paidAt }: SettleInput) {
  const invoices = readMirror<any[]>('erp_invoices', [])
  let remaining = amount
  for (const invoice of invoices.filter(isOpenInvoiceOf(customerId)).sort((a, b) => dueTime(a) - dueTime(b))) {
    if (remaining <= 0) break
    remaining = payInvoiceLocally(invoice, remaining, paidAt)
  }
  if (invoices.length) writeMirror('erp_invoices', invoices)
  if (remaining > 0) addCreditLocally(customerId, remaining)
}

interface OfflineMovement extends MovementInput {
  cashboxes: any[]
  transactions: any[]
}

export function commitCashboxMovementOffline({ cashboxes, transactions, ...input }: OfflineMovement) {
  const nextCashboxes = cashboxes.map((cb) => (cb.id === input.cashboxId ? { ...cb, balance: balanceAfter(input) } : cb))
  const nextTransactions = [
    {
      id: `local-tx-${input.cashboxId}-${input.date}-${transactions.length}`,
      ...movementRow(input),
      created_at: `${isoDate()}T00:00:00.000Z`,
    },
    ...transactions,
  ]
  writeMirror('erp_cashboxes', nextCashboxes)
  writeMirror('erp_transactions', nextTransactions)
  return { cashboxes: nextCashboxes, transactions: nextTransactions }
}

export function recordMovementOffline(movement: MovementInput, settle: SettleInput | null, lists: Omit<OfflineMovement, keyof MovementInput>) {
  if (settle) settleCustomerDebtOffline(settle)
  return commitCashboxMovementOffline({ ...movement, ...lists })
}
