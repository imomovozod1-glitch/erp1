import { isoDate } from '@/lib/utils'
import { callBusinessRpc, RPC_MISSING } from '@/lib/business-rpc'
import { localId, writeMirror } from './cashbox-mirror'
import type { CashboxFormValues } from './cashbox-form-dialog'
import type { Cashbox } from './cashbox-types'

export interface SaveContext {
  values: CashboxFormValues
  editing: Cashbox | null
  openingLabel: string
}

const renamed = (cashbox: Cashbox, { name, type, description }: CashboxFormValues): Cashbox => ({
  ...cashbox,
  name,
  type,
  description,
})

function openingTransaction(cashboxId: string, { values, openingLabel }: SaveContext) {
  return {
    type: 'income',
    amount: values.initialBalance,
    category: openingLabel,
    description: `${openingLabel} - ${values.name}`,
    reference_type: 'cashbox',
    reference_id: cashboxId,
    transaction_date: isoDate(),
  }
}

export function saveCashboxOffline(context: SaveContext, cashboxes: Cashbox[], transactions: any[]) {
  const { values, editing } = context
  if (editing) {
    const next = cashboxes.map((cb) => (cb.id === editing.id ? renamed(cb, values) : cb))
    writeMirror('erp_cashboxes', next)
    return { cashboxes: next, transactions, opened: false }
  }
  const created: Cashbox = {
    id: localId('local'),
    name: values.name,
    balance: values.initialBalance,
    type: values.type,
    description: values.description,
    created_at: new Date().toISOString(),
  }
  const opened = values.initialBalance > 0
  const nextTransactions = opened
    ? [{ id: localId('local-tx'), ...openingTransaction(created.id, context), created_at: created.created_at }, ...transactions]
    : transactions
  writeMirror('erp_cashboxes', [created, ...cashboxes])
  if (opened) writeMirror('erp_transactions', nextTransactions)
  return { cashboxes: [created, ...cashboxes], transactions: nextTransactions, opened }
}

async function createCashboxLegacy(supabase: any, context: SaveContext) {
  const { name, type, description, initialBalance } = context.values
  const { data: created, error } = await supabase
    .from('cashboxes')
    .insert([{ name, balance: initialBalance, type, description }])
    .select()
    .single()
  if (error) throw error
  const { data: auth } = await supabase.auth.getUser()
  if (initialBalance <= 0 || !auth?.user?.id || !created) return
  const { error: txError } = await supabase
    .from('transactions')
    .insert({ ...openingTransaction(created.id, context), created_by: auth.user.id })
  if (txError) throw txError
}

async function createCashbox(supabase: any, context: SaveContext) {
  const { name, type, description, initialBalance } = context.values
  const created = await callBusinessRpc(supabase, 'create_cashbox', {
    p_cashbox: { name, type, description, initial_balance: initialBalance, initial_label: context.openingLabel, date: isoDate() },
  })
  if (created === RPC_MISSING) await createCashboxLegacy(supabase, context)
}

export async function saveCashboxOnline(supabase: any, context: SaveContext) {
  if (!context.editing) return createCashbox(supabase, context)
  const { name, type, description } = context.values
  const { error } = await supabase.from('cashboxes').update({ name, type, description }).eq('id', context.editing.id)
  if (error) throw error
}
