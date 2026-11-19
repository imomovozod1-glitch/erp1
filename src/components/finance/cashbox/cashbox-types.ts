export type CashboxType = 'cash' | 'card' | 'transfer' | 'other'
export type CashboxPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
export type MovementType = 'income' | 'expense'
export type PersonType = 'employee' | 'supplier' | 'customer' | 'none'

export interface Cashbox {
  id: string
  name: string
  balance: number
  type: CashboxType
  description: string
  created_at: string
}

export interface TransactionCategory {
  id: string
  name: string
  type: MovementType
  person_type: PersonType
}

export interface NamedRow {
  id: string
  name: string
}

export interface CashboxPageData {
  failed: boolean
  cashboxes: Cashbox[]
  transactions: any[]
  customers: NamedRow[]
  employees: NamedRow[]
  suppliers: NamedRow[]
  categories: TransactionCategory[]
}

export const isMainCashbox = (cashbox: Pick<Cashbox, 'name'>) => /asosiy|main/i.test(cashbox.name)
