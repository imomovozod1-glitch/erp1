export interface SalesOrderRow {
  id: string
  order_number?: string | null
  status: string
}

export type SaleCashboxType = 'cash' | 'card' | 'transfer'

/**
 * Which cashbox type a sale paid into. Orders carry no payment-method column;
 * both sale paths write it into free text instead — POS into the order notes
 * ("POS Sale - Paid via CARD"), the sale form into the invoice notes
 * ("Paid via card"). `undefined` means the primary cashbox.
 */
export function salePaymentMethod(texts: (string | null | undefined)[]): SaleCashboxType | undefined {
  for (const text of texts) {
    const match = text?.match(/paid (?:instantly on POS )?via (cash|card|transfer)\b/i)
    if (match) return match[1].toLowerCase() as SaleCashboxType
  }
  return undefined
}

export class SaleCancelError extends Error {
  constructor(
    public readonly code: 'already_cancelled' | 'insufficient_cashbox' | 'forbidden',
    public readonly details: { cashboxName?: string; balance?: number; amount?: number } = {}
  ) {
    super(code)
    this.name = 'SaleCancelError'
  }
}

export interface SaleCancelResult {
  /** Money taken back out of a cashbox (cash/card/transfer sales). */
  refunded: number
  cashboxName: string | null
  /**
   * What the customer had already paid towards this sale outside the sale's own
   * income transaction — credit (haqdorlik) spent on it and debt collected for
   * it. Returned to their credit balance.
   */
  creditRestored: number
}
