import { createClient } from '@/lib/supabase/client'
import {
  AUTO_CASHBOX_DESCRIPTION,
  CASHBOX_TYPE_NAMES,
  InsufficientFundsError,
  assertCanWithdraw,
  pickTargetCashbox,
  type CashboxKind,
} from './cashbox-target'
import { adjustLocalCashboxes, mirrorLocalCashboxes } from './cashbox-local'

type Direction = 'income' | 'expense'

const listCashboxes = async (supabase: any) => {
  const { data, error } = await supabase.from('cashboxes').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as any[]
}

async function readBalance(supabase: any, cashboxId: string) {
  const { data, error } = await supabase.from('cashboxes').select('balance').eq('id', cashboxId).single()
  if (error) throw error
  return Number(data?.balance) || 0
}

async function writeBalance(supabase: any, cashboxId: string, balance: number) {
  const { error } = await supabase.from('cashboxes').update({ balance }).eq('id', cashboxId)
  if (error) throw error
}

export async function findSaleCashbox(supabase: any, kind?: CashboxKind) {
  const list = await listCashboxes(supabase)
  const target = pickTargetCashbox(list, kind) ?? pickTargetCashbox(list)
  return target ? { id: target.id as string, name: target.name as string, balance: Number(target.balance) || 0 } : null
}

export async function withdrawFromCashbox(supabase: any, cashboxId: string, amount: number) {
  const balance = await readBalance(supabase, cashboxId)
  assertCanWithdraw(balance, amount)
  await writeBalance(supabase, cashboxId, balance - amount)
}

export async function depositToCashbox(supabase: any, cashboxId: string, amount: number) {
  await writeBalance(supabase, cashboxId, (await readBalance(supabase, cashboxId)) + amount)
}

async function createAutoCashbox(supabase: any, kind: CashboxKind, balance: number) {
  const { error } = await supabase
    .from('cashboxes')
    .insert({ name: CASHBOX_TYPE_NAMES[kind], type: kind, balance, description: AUTO_CASHBOX_DESCRIPTION })
  if (error) throw error
}

async function adjustOnline(supabase: any, amount: number, type: Direction, kind?: CashboxKind) {
  const change = type === 'income' ? amount : -amount
  const target = pickTargetCashbox(await listCashboxes(supabase), kind)
  const balance = target ? Number(target.balance) || 0 : 0
  if (type === 'expense') assertCanWithdraw(balance, amount)
  if (target) await writeBalance(supabase, target.id, balance + change)
  else await createAutoCashbox(supabase, kind ?? 'cash', change)
  mirrorLocalCashboxes(change, kind)
}

export async function adjustCashboxBalance(amount: number, type: Direction, supabase?: any, kind?: CashboxKind) {
  try {
    await adjustOnline(supabase ?? createClient(), amount, type, kind)
  } catch (error) {
    if (error instanceof InsufficientFundsError) throw error
    console.warn('Supabase cashboxes update failed, falling back to LocalStorage:', error)
    adjustLocalCashboxes(amount, type, kind)
  }
}
