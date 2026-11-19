export type CashboxKind = 'cash' | 'card' | 'transfer' | 'other'

export class InsufficientFundsError extends Error {
  constructor(balance: number, amount: number) {
    super(`Insufficient funds: cashbox balance is ${balance}, cannot withdraw ${amount}`)
    this.name = 'InsufficientFundsError'
  }
}

export const CASHBOX_TYPE_NAMES: Record<CashboxKind, string> = {
  cash: 'Naqd kassa',
  card: 'Karta kassasi',
  transfer: "O'tkazma kassasi",
  other: 'Boshqa kassa',
}

export const AUTO_CASHBOX_DESCRIPTION = 'Sotuvlar va tolovlar uchun avtomatik yaratilgan kassa'

const isPrimaryName = (cashbox: any) => /asosiy|main|основн/i.test(String(cashbox?.name ?? ''))

const createdTime = (cashbox: any) => new Date(cashbox.created_at ?? 0).getTime()

// The oldest drawer is the one the company set up; newer cash drawers are usually
// auto-created per employee, so "first in a newest-first list" would pick the wrong one.
function preferPrimary(candidates: any[]) {
  if (candidates.length === 0) return null
  return candidates.find(isPrimaryName) ?? [...candidates].sort((a, b) => createdTime(a) - createdTime(b))[0]
}

// A requested payment type with no matching drawer answers null: the caller creates
// one rather than crediting an unrelated drawer.
export const pickTargetCashbox = (cashboxes: any[], kind?: CashboxKind) =>
  preferPrimary(kind ? cashboxes.filter((c) => c.type === kind) : cashboxes)

export function assertCanWithdraw(balance: number, amount: number) {
  if (amount > balance) throw new InsufficientFundsError(balance, amount)
}
