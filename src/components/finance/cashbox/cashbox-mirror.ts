import type { CashboxPageData } from './cashbox-types'

export function readMirror<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeMirror(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode, quota): the screen state already holds the change.
  }
}

export const localId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 11)}`

export const readMirrorSnapshot = (): CashboxPageData => ({
  failed: true,
  cashboxes: readMirror('erp_cashboxes', []),
  transactions: readMirror('erp_transactions', []),
  customers: readMirror('erp_customers', []),
  employees: readMirror('erp_employees', []),
  suppliers: readMirror('erp_suppliers', []),
  categories: readMirror('erp_transaction_categories', []),
})
