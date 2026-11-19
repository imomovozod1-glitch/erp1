import {
  AUTO_CASHBOX_DESCRIPTION,
  CASHBOX_TYPE_NAMES,
  InsufficientFundsError,
  assertCanWithdraw,
  pickTargetCashbox,
  type CashboxKind,
} from './cashbox-target'

const KEY = 'erp_cashboxes'

function readLocal(): any[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.error('Failed to read local cashboxes:', error)
    return null
  }
}

const writeLocal = (cashboxes: any[]) => localStorage.setItem(KEY, JSON.stringify(cashboxes))

export function mirrorLocalCashboxes(change: number, kind?: CashboxKind) {
  const cashboxes = readLocal()
  const target = cashboxes && pickTargetCashbox(cashboxes, kind)
  if (!cashboxes || !target) return
  target.balance = (Number(target.balance) || 0) + change
  writeLocal(cashboxes)
}

function addLocalCashbox(cashboxes: any[], kind: CashboxKind, balance: number) {
  cashboxes.push({
    id: `local-${Date.now()}`,
    name: CASHBOX_TYPE_NAMES[kind],
    type: kind,
    balance,
    description: AUTO_CASHBOX_DESCRIPTION,
  })
}

export function adjustLocalCashboxes(amount: number, type: 'income' | 'expense', kind?: CashboxKind) {
  const cashboxes = readLocal()
  if (!cashboxes?.length) return
  const change = type === 'income' ? amount : -amount
  const target = pickTargetCashbox(cashboxes, kind)
  try {
    if (type === 'expense') assertCanWithdraw(target ? Number(target.balance) || 0 : 0, amount)
    if (target) target.balance = (Number(target.balance) || 0) + change
    else addLocalCashbox(cashboxes, kind ?? 'other', change)
    writeLocal(cashboxes)
  } catch (error) {
    if (error instanceof InsufficientFundsError) throw error
    console.error('Failed to update local cashboxes:', error)
  }
}
