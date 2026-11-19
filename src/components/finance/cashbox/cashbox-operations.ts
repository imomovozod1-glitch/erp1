import { balanceAfter, movementRow, type MovementInput } from './cashbox-movement'
import { outstandingOf } from './invoice-balance'
import { callBusinessRpc, RPC_MISSING } from '@/lib/business-rpc'

// Pre-migration fallback: `record_cashbox_movement` (supabase/migration_business_rpc.sql)
// does both steps in one transaction. Remove these once that migration is everywhere.

async function payInvoice(supabase: any, invoice: any, remaining: number, paidAt: string): Promise<number> {
  const outstanding = outstandingOf(invoice)
  const settled = remaining >= outstanding
  const patch = settled
    ? { paid_amount: invoice.total_amount, status: 'paid', paid_at: paidAt }
    : { paid_amount: (Number(invoice.paid_amount) || 0) + remaining }
  const { error } = await supabase.from('invoices').update(patch).eq('id', invoice.id)
  if (error) throw error
  return settled ? remaining - outstanding : 0
}

async function addCustomerCredit(supabase: any, customerId: string, amount: number) {
  const { data: customer, error: readErr } = await supabase
    .from('customers')
    .select('credit_balance')
    .eq('id', customerId)
    .single()
  if (readErr || !customer) return
  const { error } = await supabase
    .from('customers')
    .update({ credit_balance: (Number(customer.credit_balance) || 0) + amount })
    .eq('id', customerId)
  if (error) throw error
}

export interface SettleInput {
  customerId: string
  amount: number
  paidAt: string
}

export async function settleCustomerDebt({ supabase, customerId, amount, paidAt }: SettleInput & { supabase: any }) {
  const { data: unpaid, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('customer_id', customerId)
    .not('status', 'in', '("paid","cancelled")')
    .order('due_at', { ascending: true })
  if (error) throw error

  let remaining = amount
  for (const invoice of unpaid || []) {
    if (remaining <= 0) break
    remaining = await payInvoice(supabase, invoice, remaining, paidAt)
  }
  if (remaining > 0) await addCustomerCredit(supabase, customerId, remaining)
}

export async function commitCashboxMovement({
  supabase,
  userId,
  ...input
}: MovementInput & { supabase: any; userId: string }) {
  const { error: balanceErr } = await supabase
    .from('cashboxes')
    .update({ balance: balanceAfter(input) })
    .eq('id', input.cashboxId)
  if (balanceErr) throw balanceErr

  const { error: txErr } = await supabase.from('transactions').insert([{ ...movementRow(input), created_by: userId }])
  if (txErr) throw txErr
}


export interface RecordInput {
  supabase: any
  userId: string
  movement: MovementInput
  settle: SettleInput | null
}

const toRpcMovement = (movement: MovementInput) => ({
  cashbox_id: movement.cashboxId,
  type: movement.type,
  amount: movement.amount,
  category: movement.category,
  description: movement.description,
  person_type: movement.personType,
  person_id: movement.personId,
  date: movement.date,
})

export async function recordMovementOnline({ supabase, userId, movement, settle }: RecordInput) {
  const recorded = await callBusinessRpc(supabase, 'record_cashbox_movement', { p_movement: toRpcMovement(movement) })
  if (recorded !== RPC_MISSING) return
  if (settle) await settleCustomerDebt({ supabase, ...settle })
  await commitCashboxMovement({ ...movement, supabase, userId })
}
