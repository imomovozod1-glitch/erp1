export interface SaleLineEdit {
  id: string
  unitPrice: number
  remove: boolean
}

export class SaleEditError extends Error {
  constructor(
    public readonly code: 'order_cancelled' | 'no_lines_left' | 'insufficient_cashbox' | 'forbidden' | 'not_found',
    public readonly details: { cashboxName?: string; balance?: number; amount?: number } = {}
  ) {
    super(code)
    this.name = 'SaleEditError'
  }
}

export interface SaleEditResult {
  changed: boolean
  newTotal: number
  /** Positive: added to the cashbox. Negative: taken out of it. */
  cashboxDelta: number
  cashboxName: string | null
  /** Paid beyond the new total on a debt sale, moved to the customer's credit. */
  creditAdded: number
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export const saleLineTotal = (unitPrice: number, quantity: number, discountPercent: number | null | undefined) =>
  round2(unitPrice * quantity * (1 - (Number(discountPercent) || 0) / 100))

/** The total the till would charge: the order-level discount never exceeds the lines it applies to. */
export function saleOrderTotal(lineTotals: number[], discountAmount: number, taxAmount: number) {
  const subtotal = lineTotals.reduce((sum, n) => sum + n, 0)
  const discount = Math.min(Math.max(Number(discountAmount) || 0, 0), subtotal)
  return { total: round2(subtotal - discount + (Number(taxAmount) || 0)), discount: round2(discount) }
}

export interface ItemRow {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  unit_cost: number | null
  discount_percent: number | null
}

/** Which lines go, which get a new price, and what the kept lines add up to. */
export function planLineEdits(rows: ItemRow[], edits: SaleLineEdit[]) {
  const editById = new Map(edits.map((edit) => [edit.id, edit]))
  const removed: ItemRow[] = []
  const repriced: { row: ItemRow; unitPrice: number }[] = []
  const keptTotals: number[] = []
  for (const row of rows) {
    const edit = editById.get(row.id)
    if (edit?.remove) {
      removed.push(row)
      continue
    }
    const unitPrice = edit ? Math.max(0, Number(edit.unitPrice) || 0) : Number(row.unit_price) || 0
    if (edit && unitPrice !== (Number(row.unit_price) || 0)) repriced.push({ row, unitPrice })
    keptTotals.push(saleLineTotal(unitPrice, Number(row.quantity) || 0, row.discount_percent))
  }
  return { removed, repriced, keptTotals }
}

export const unchanged = (total: number): SaleEditResult => ({ changed: false, newTotal: total, cashboxDelta: 0, cashboxName: null, creditAdded: 0 })
