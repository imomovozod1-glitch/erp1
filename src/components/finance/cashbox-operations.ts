import { isoDate } from '@/lib/utils'

/**
 * What a kirim/chiqim actually does to the books.
 *
 * Two things happen when money moves through a cashbox, and both were written
 * inline in the middle of `cashbox-client.tsx`:
 *
 *   1. income received FROM A CUSTOMER pays down their oldest unpaid invoices,
 *      and anything left over becomes credit (haqdorlik) on their account;
 *   2. the cashbox balance moves and the movement is recorded.
 *
 * Each exists twice — once against Supabase, once against the localStorage
 * mirror the screen falls back to when Supabase is unreachable. Keeping the
 * four in one module is what makes that pairing visible; in the component they
 * were 250 lines apart inside one `try`, and the offline twin had already
 * drifted (it settled invoices before checking the session, so a missing
 * session could leave invoices marked paid with no transaction recorded).
 *
 * Nothing here touches React, toasts or translations.
 */

export type MovementType = 'income' | 'expense'
export type PersonType = 'employee' | 'supplier' | 'customer' | 'none'

interface MovementInput {
  cashboxId: string
  /** The balance as the screen currently knows it. */
  currentBalance: number
  type: MovementType
  amount: number
  category: string
  description: string | null
  personType: PersonType
  personId: string | null
  /** `YYYY-MM-DD` — the day the money moved, not necessarily today. */
  date: string
}

/** The row shape both paths write, minus what only one of them can supply. */
function movementRow(input: MovementInput) {
  return {
    type: input.type,
    amount: input.amount,
    category: input.category,
    description: input.description,
    reference_type: 'cashbox',
    reference_id: input.cashboxId,
    employee_id: input.personType === 'employee' ? input.personId : null,
    supplier_id: input.personType === 'supplier' ? input.personId : null,
    customer_id: input.personType === 'customer' ? input.personId : null,
    transaction_date: input.date,
  }
}

export function balanceAfter(input: Pick<MovementInput, 'currentBalance' | 'type' | 'amount'>) {
  return Number(input.currentBalance) + (input.type === 'income' ? input.amount : -input.amount)
}

// ─── Online ───────────────────────────────────────────────────────────────────

/**
 * Applies `amount` to the customer's unpaid invoices, oldest due date first.
 *
 * This is what makes the "collect debt" button on the invoices page work. An
 * amount larger than the whole debt is not an error: the remainder becomes
 * credit on the customer's account, so they are never shown a credit balance
 * and a debt at the same time for the same money.
 */
export async function settleCustomerDebt({
  supabase,
  customerId,
  amount,
  paidAt,
}: {
  supabase: any
  customerId: string
  amount: number
  paidAt: string
}): Promise<void> {
  let remaining = amount

  const { data: unpaidInvoices, error: fetchErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('customer_id', customerId)
    .not('status', 'in', '("paid","cancelled")')
    .order('due_at', { ascending: true })
  if (fetchErr) throw fetchErr

  for (const invoice of unpaidInvoices || []) {
    if (remaining <= 0) break
    const outstanding = (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0)

    if (remaining >= outstanding) {
      const { error } = await supabase
        .from('invoices')
        .update({ paid_amount: invoice.total_amount, status: 'paid', paid_at: paidAt })
        .eq('id', invoice.id)
      if (error) throw error
      remaining -= outstanding
    } else {
      const { error } = await supabase
        .from('invoices')
        .update({ paid_amount: (Number(invoice.paid_amount) || 0) + remaining })
        .eq('id', invoice.id)
      if (error) throw error
      remaining = 0
    }
  }

  if (remaining <= 0) return

  const { data: customer, error: readErr } = await supabase
    .from('customers')
    .select('credit_balance')
    .eq('id', customerId)
    .single()
  if (readErr || !customer) return

  const { error: creditErr } = await supabase
    .from('customers')
    .update({ credit_balance: (Number(customer.credit_balance) || 0) + remaining })
    .eq('id', customerId)
  if (creditErr) throw creditErr
}

/** Moves the cashbox balance and records the movement against it. */
export async function commitCashboxMovement({
  supabase,
  userId,
  ...input
}: MovementInput & { supabase: any; userId: string }): Promise<void> {
  const { error: balanceErr } = await supabase
    .from('cashboxes')
    .update({ balance: balanceAfter(input) })
    .eq('id', input.cashboxId)
  if (balanceErr) throw balanceErr

  const { error: txErr } = await supabase
    .from('transactions')
    .insert([{ ...movementRow(input), created_by: userId }])
  if (txErr) throw txErr
}

// ─── Offline mirror ───────────────────────────────────────────────────────────
//
// Used only when the server could not read the cashboxes at all. Writes go to
// the same localStorage keys `adjustCashboxBalance` (finance-helpers.ts) uses,
// so the two agree about what the browser holds while Supabase is away.

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private browsing, quota). Nothing to recover here —
    // the sale/movement is already reflected in component state.
  }
}

/** `settleCustomerDebt`, against the localStorage mirror. */
export function settleCustomerDebtOffline({
  customerId,
  amount,
  paidAt,
}: {
  customerId: string
  amount: number
  paidAt: string
}): void {
  let remaining = amount

  const invoices = readLocal<any[]>('erp_invoices')
  if (invoices) {
    const unpaid = invoices
      .filter(
        (i) => i.customer_id === customerId && i.status !== 'paid' && i.status !== 'cancelled'
      )
      .sort(
        (a, b) =>
          new Date(a.due_at || a.created_at).getTime() -
          new Date(b.due_at || b.created_at).getTime()
      )

    for (const invoice of unpaid) {
      if (remaining <= 0) break
      const outstanding = (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0)
      if (remaining >= outstanding) {
        invoice.paid_amount = invoice.total_amount
        invoice.status = 'paid'
        invoice.paid_at = paidAt
        remaining -= outstanding
      } else {
        invoice.paid_amount = (Number(invoice.paid_amount) || 0) + remaining
        remaining = 0
      }
    }
    writeLocal('erp_invoices', invoices)
  }

  if (remaining <= 0) return

  const customers = readLocal<any[]>('erp_customers')
  if (!customers) return
  const index = customers.findIndex((c) => c.id === customerId)
  if (index === -1) return
  customers[index].credit_balance = (Number(customers[index].credit_balance) || 0) + remaining
  writeLocal('erp_customers', customers)
}

/**
 * `commitCashboxMovement`, against the localStorage mirror.
 *
 * Returns the updated lists rather than setting them: the component owns its
 * own state, this only decides what they should become.
 */
export function commitCashboxMovementOffline({
  cashboxes,
  transactions,
  ...input
}: MovementInput & { cashboxes: any[]; transactions: any[] }): {
  cashboxes: any[]
  transactions: any[]
} {
  const nextCashboxes = cashboxes.map((cb) =>
    cb.id === input.cashboxId ? { ...cb, balance: balanceAfter(input) } : cb
  )
  writeLocal('erp_cashboxes', nextCashboxes)

  const nextTransactions = [
    {
      // Local-only id: this row exists solely so the history shows the movement
      // until the browser is back online and the screen re-reads from Postgres.
      id: `local-tx-${input.cashboxId}-${input.date}-${transactions.length}`,
      ...movementRow(input),
      created_at: `${isoDate()}T00:00:00.000Z`,
    },
    ...transactions,
  ]
  writeLocal('erp_transactions', nextTransactions)

  return { cashboxes: nextCashboxes, transactions: nextTransactions }
}

// ─── The kirim/chiqim form ────────────────────────────────────────────────────

/** Everything the income/expense dialog collects, in one value. */
export interface CashboxTransactionForm {
  type: MovementType
  amount: number | ''
  categoryId: string
  /** `YYYY-MM-DD`. */
  date: string
  description: string
  /** Set only when the chosen category is tied to that kind of person. */
  customerId: string
  employeeId: string
  supplierId: string
}

export const emptyTransactionForm: CashboxTransactionForm = {
  type: 'income',
  amount: '',
  categoryId: '',
  date: '',
  description: '',
  customerId: '',
  employeeId: '',
  supplierId: '',
}
