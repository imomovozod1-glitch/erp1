'use client'

import { depositToCashbox, findSaleCashbox, withdrawFromCashbox } from '@/lib/finance-helpers'
import { returnLinesToStock, salePaymentMethod } from '@/lib/status-actions'
import { isoDate } from '@/lib/utils'

/**
 * Editing the lines of a sale that has already happened.
 *
 * A sale's lines are not just rows: they took goods out of stock, and their sum
 * is what went into a cashbox or onto the customer's debt. So changing one has
 * to carry through:
 *
 *   - a removed line goes back into stock (`returnLinesToStock`) and is deleted;
 *   - a new price rewrites the line total, and the order total is recomputed the
 *     way the till computes it (lines − order discount + tax);
 *   - the difference against the old total moves money: a cash/card/transfer
 *     sale gets it added to / taken out of its cashbox and its income
 *     transaction corrected; a debt sale gets its invoice total changed, which
 *     is what the customer's debt is computed from — and if they had already
 *     paid more than the new total, the excess becomes credit (haqdorlik).
 *
 * Like cancelling (`cancelSalesOrder`), this is several browser writes, not one
 * database transaction. What can refuse — the cashbox no longer holding the
 * money to refund — is checked before the first write.
 */

export interface SaleLineEdit {
  /** `sales_order_items.id` */
  id: string
  unitPrice: number
  remove: boolean
}

export class SaleEditError extends Error {
  constructor(
    public readonly code: 'order_cancelled' | 'no_lines_left' | 'insufficient_cashbox',
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

interface ItemRow {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  unit_cost: number | null
  discount_percent: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function saleLineTotal(unitPrice: number, quantity: number, discountPercent: number | null | undefined) {
  return round2(unitPrice * quantity * (1 - (Number(discountPercent) || 0) / 100))
}

/**
 * The order total the till would have charged for these lines: the flat
 * order-level discount can never exceed the lines it applies to.
 */
export function saleOrderTotal(lineTotals: number[], discountAmount: number, taxAmount: number) {
  const subtotal = lineTotals.reduce((sum, n) => sum + n, 0)
  const discount = Math.min(Math.max(Number(discountAmount) || 0, 0), subtotal)
  return { total: round2(subtotal - discount + (Number(taxAmount) || 0)), discount: round2(discount) }
}

export async function updateSaleLines(
  supabase: any,
  orderId: string,
  edits: SaleLineEdit[],
  userId: string | null
): Promise<SaleEditResult> {
  const [
    { data: order, error: orderError },
    { data: items, error: itemsError },
    { data: invoices, error: invoicesError },
    { data: incomeTxs, error: txError },
  ] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id, order_number, status, notes, customer_id, total_amount, discount_amount, tax_amount')
      .eq('id', orderId)
      .single(),
    supabase
      .from('sales_order_items')
      .select('id, product_id, quantity, unit_price, unit_cost, discount_percent')
      .eq('order_id', orderId),
    supabase
      .from('invoices')
      .select('id, status, total_amount, paid_amount, paid_at, notes')
      .eq('order_id', orderId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('id, amount')
      .eq('reference_type', 'sales_orders')
      .eq('reference_id', orderId)
      .eq('type', 'income')
      .order('created_at', { ascending: true }),
  ])
  if (orderError) throw new Error(orderError.message)
  if (itemsError) throw new Error(itemsError.message)
  if (invoicesError) throw new Error(invoicesError.message)
  if (txError) throw new Error(txError.message)
  if (order.status === 'cancelled') throw new SaleEditError('order_cancelled')

  const editById = new Map(edits.map((edit) => [edit.id, edit]))
  const rows = (items ?? []) as ItemRow[]

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

  const oldTotal = Number(order.total_amount) || 0
  if (removed.length === 0 && repriced.length === 0) {
    return { changed: false, newTotal: oldTotal, cashboxDelta: 0, cashboxName: null, creditAdded: 0 }
  }
  // Removing every line is a cancellation, which has its own flow.
  if (keptTotals.length === 0) throw new SaleEditError('no_lines_left')

  const { total: newTotal, discount } = saleOrderTotal(keptTotals, order.discount_amount, order.tax_amount)
  const delta = round2(newTotal - oldTotal)

  // Only a cash/card/transfer sale writes an income transaction.
  const txs = (incomeTxs ?? []) as { id: string; amount: number }[]
  const isCashSale = txs.length > 0
  const liveInvoices = (invoices ?? []) as {
    id: string
    status: string
    total_amount: number
    paid_amount: number | null
    paid_at: string | null
    notes: string | null
  }[]
  const invoice = liveInvoices[0] ?? null

  let cashbox: { id: string; name: string; balance: number } | null = null
  if (isCashSale && delta !== 0) {
    const method = salePaymentMethod([order.notes, ...liveInvoices.map((inv) => inv.notes)])
    cashbox = await findSaleCashbox(supabase, method)
    if (!cashbox || (delta < 0 && cashbox.balance < -delta)) {
      throw new SaleEditError('insufficient_cashbox', {
        cashboxName: cashbox?.name,
        balance: cashbox?.balance ?? 0,
        amount: -delta,
      })
    }
  }

  // Lines first — they are what the new total is made of.
  for (const { row, unitPrice } of repriced) {
    const { error } = await supabase
      .from('sales_order_items')
      .update({
        unit_price: unitPrice,
        total_price: saleLineTotal(unitPrice, Number(row.quantity) || 0, row.discount_percent),
      })
      .eq('id', row.id)
    if (error) throw new Error(error.message)
  }

  if (removed.length > 0) {
    await returnLinesToStock(supabase, {
      orderId,
      lines: removed,
      reason: `Removed from order ${order.order_number ?? ''}`.trim(),
      userId,
    })
    const { error } = await supabase
      .from('sales_order_items')
      .delete()
      .in('id', removed.map((row) => row.id))
    if (error) throw new Error(error.message)
  }

  const { error: orderUpdateError } = await supabase
    .from('sales_orders')
    .update({ total_amount: newTotal, discount_amount: discount })
    .eq('id', orderId)
  if (orderUpdateError) throw new Error(orderUpdateError.message)

  let creditAdded = 0

  if (isCashSale) {
    if (cashbox && delta < 0) await withdrawFromCashbox(supabase, cashbox.id, -delta)
    if (cashbox && delta > 0) await depositToCashbox(supabase, cashbox.id, delta)
    if (delta !== 0) {
      // The sale's income is the sum of its transactions; correct the first one
      // by the difference so reports count exactly what is now in the drawer.
      const { error } = await supabase
        .from('transactions')
        .update({ amount: round2((Number(txs[0].amount) || 0) + delta) })
        .eq('id', txs[0].id)
      if (error) throw new Error(error.message)
    }
    if (invoice) {
      const { error } = await supabase
        .from('invoices')
        .update({ total_amount: newTotal, paid_amount: newTotal })
        .eq('id', invoice.id)
      if (error) throw new Error(error.message)
    }
  } else if (invoice) {
    // Debt sale: the customer's debt is `total_amount - paid_amount` on this
    // invoice, so changing the total is what changes the debt.
    let paid = Number(invoice.paid_amount) || 0
    if (paid > newTotal) {
      creditAdded = round2(paid - newTotal)
      paid = newTotal
    }
    const fullyPaid = paid >= newTotal
    const { error } = await supabase
      .from('invoices')
      .update({
        total_amount: newTotal,
        paid_amount: paid,
        status: fullyPaid ? 'paid' : invoice.status === 'paid' ? 'sent' : invoice.status,
        paid_at: fullyPaid ? (invoice.paid_at ?? isoDate()) : null,
      })
      .eq('id', invoice.id)
    if (error) throw new Error(error.message)

    if (creditAdded > 0 && order.customer_id) {
      const { data: customer, error: readError } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', order.customer_id)
        .single()
      if (readError) throw new Error(readError.message)
      const { error: creditError } = await supabase
        .from('customers')
        .update({ credit_balance: (Number(customer?.credit_balance) || 0) + creditAdded })
        .eq('id', order.customer_id)
      if (creditError) throw new Error(creditError.message)
    } else {
      creditAdded = 0
    }
  }

  return {
    changed: true,
    newTotal,
    cashboxDelta: isCashSale ? delta : 0,
    cashboxName: cashbox?.name ?? null,
    creditAdded,
  }
}
