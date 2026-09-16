/**
 * What the company owes its suppliers (kreditorlik).
 *
 * `purchase_orders` has no paid column, so a supplier's balance is what we
 * have received from them minus what we have paid them:
 *
 *   - only goods actually received create a debt: a `draft` or `sent` order is
 *     still just an order, and a `cancelled` one never owed anything;
 *   - a `partially_received` order owes for the part that arrived
 *     (received quantity × unit cost), a `received` one its full total;
 *   - payments are the `expense` transactions tagged with the supplier — a
 *     stray income row tagged with them must not net against the debt.
 *
 * Used by the dashboard's payables figure, the supplier detail page and the
 * cashbox's "pay a supplier" dialog, so all three show the same number.
 */

export interface SupplierOrderRow {
  supplier_id?: string | null
  status: string
  total_amount: number | string | null
  purchase_order_items?: { received_qty: number | string | null; unit_cost: number | string | null }[] | null
}

export interface SupplierPaymentRow {
  supplier_id?: string | null
  type?: string | null
  amount: number | string | null
}

/** Columns to select on `purchase_orders` for `orderOwed`. */
export const SUPPLIER_ORDER_COLUMNS = 'supplier_id, status, total_amount, purchase_order_items(received_qty, unit_cost)'

/** What one purchase order puts on the supplier's account. */
export function orderOwed(order: SupplierOrderRow): number {
  if (order.status === 'received') return Number(order.total_amount) || 0
  if (order.status === 'partially_received') {
    return (order.purchase_order_items ?? []).reduce(
      (sum, item) => sum + (Number(item.received_qty) || 0) * (Number(item.unit_cost) || 0),
      0
    )
  }
  return 0
}

function paid(payment: SupplierPaymentRow): number {
  // Rows selected without `type` are already filtered to expenses.
  return payment.type == null || payment.type === 'expense' ? Number(payment.amount) || 0 : 0
}

/**
 * One supplier's balance. Positive: we owe them. Negative: we paid ahead
 * (an advance), which is shown as such on that supplier's own page.
 */
export function supplierBalance(orders: SupplierOrderRow[], payments: SupplierPaymentRow[]): number {
  const owed = orders.reduce((sum, order) => sum + orderOwed(order), 0)
  const settled = payments.reduce((sum, payment) => sum + paid(payment), 0)
  return owed - settled
}

/**
 * The company's total payables: every supplier's balance on its own, and only
 * what is actually owed. An advance paid to one supplier does not reduce what
 * is owed to another, so it is not netted in.
 */
export function totalPayables(orders: SupplierOrderRow[], payments: SupplierPaymentRow[]): number {
  const balances = new Map<string, number>()
  for (const order of orders) {
    if (!order.supplier_id) continue
    balances.set(order.supplier_id, (balances.get(order.supplier_id) ?? 0) + orderOwed(order))
  }
  for (const payment of payments) {
    if (!payment.supplier_id) continue
    balances.set(payment.supplier_id, (balances.get(payment.supplier_id) ?? 0) - paid(payment))
  }
  let total = 0
  for (const balance of balances.values()) {
    if (balance > 0) total += balance
  }
  return Math.round(total * 100) / 100
}
