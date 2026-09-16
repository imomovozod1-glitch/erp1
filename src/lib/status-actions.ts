'use client'

import type { OrderStatus, InvoiceStatus } from '@/lib/statuses'
import { findSaleCashbox, withdrawFromCashbox } from '@/lib/finance-helpers'
import { recordCostLayer } from '@/lib/inventory-costing'

/**
 * Status transitions that have side effects.
 *
 * Everything here runs through the browser Supabase client, the way the rest
 * of the app writes (see CLAUDE.md → Data layer). The point of the module is
 * that a status change is not always "write one column": a sale already took
 * goods out of stock and money into a cashbox or onto a customer's debt, so
 * cancelling it has to reverse all of that, otherwise the books silently drift
 * every time someone cancels an order.
 */

interface SalesOrderRow {
  id: string
  order_number?: string | null
  status: string
}

/** Plain status write, for transitions with no stock or money consequences. */
export async function setOrderStatus(
  supabase: any,
  orderId: string,
  status: Exclude<OrderStatus, 'cancelled'>
): Promise<void> {
  const { error } = await supabase.from('sales_orders').update({ status }).eq('id', orderId)
  if (error) throw new Error(error.message)
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

export interface SoldLine {
  product_id: string
  quantity: number
  unit_cost: number | null
}

/**
 * Puts sold lines back on the shelf: stock goes up (from a fresh read — the
 * page snapshot can be minutes old and other tills sell in the meantime), each
 * return is logged as an `in` movement, and the units go back into the cost
 * layers at the cost the sale was charged, so stock valuation and later
 * FIFO/LIFO costs match what is on the shelf again.
 *
 * Shared by cancelling a whole sale and removing single lines from one.
 */
export async function returnLinesToStock(
  supabase: any,
  { orderId, lines, reason, userId }: { orderId: string; lines: SoldLine[]; reason: string; userId: string | null }
): Promise<void> {
  if (lines.length === 0) return

  const productIds = [...new Set(lines.map((line) => line.product_id))]
  const { data: fresh, error: freshError } = await supabase
    .from('products')
    .select('id, stock')
    .in('id', productIds)
  if (freshError) throw new Error(freshError.message)

  const stockById = new Map<string, number>(
    (fresh ?? []).map((p: { id: string; stock: number }) => [p.id, Number(p.stock) || 0])
  )

  for (const line of lines) {
    const before = stockById.get(line.product_id)
    if (before === undefined) continue // product deleted since the sale
    const quantity = Number(line.quantity) || 0
    const after = before + quantity
    // Keep the map current so the same product on two lines accumulates
    // instead of the second line overwriting the first.
    stockById.set(line.product_id, after)

    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: after })
      .eq('id', line.product_id)
    if (stockError) throw new Error(stockError.message)

    const unitCost = line.unit_cost == null ? null : Number(line.unit_cost) || 0
    const { error: movementError } = await supabase.from('stock_movements').insert({
      product_id: line.product_id,
      type: 'in',
      quantity,
      quantity_before: before,
      quantity_after: after,
      reference_type: 'sales_orders',
      reference_id: orderId,
      reason,
      unit_cost: unitCost,
      total_cost: unitCost == null ? null : unitCost * quantity,
      created_by: userId,
    })
    if (movementError) throw new Error(movementError.message)

    if (unitCost != null) {
      await recordCostLayer(supabase, {
        productId: line.product_id,
        quantity,
        unitCost,
        sourceType: 'sale_cancellation',
        sourceId: orderId,
      })
    }
  }
}

export class SaleCancelError extends Error {
  constructor(
    public readonly code: 'already_cancelled' | 'insufficient_cashbox',
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

/**
 * Cancels a sale and undoes everything it did:
 *
 *   - goods go back into stock, logged as `in` movements, and their cost is put
 *     back as a new cost layer at the unit cost the sale was charged;
 *   - money a cash/card/transfer sale put into a cashbox is taken back out, and
 *     the sale's income transaction is removed so reports stop counting it;
 *   - the invoice is cancelled, which is what removes a debt sale's debt;
 *   - whatever the customer had already paid towards it — credit spent on it,
 *     debt collected for it — is returned to their credit balance, because that
 *     money is real and now belongs to them again.
 *
 * Writes go through the browser client like the rest of the app, so this is not
 * one database transaction. The order is chosen to fail safe: what can refuse
 * (the cashbox no longer holding the money) is checked before the first write,
 * and the status flip — guarded so two people cancelling at once cannot both
 * get past it — comes before any reversal, so a retry can never refund twice.
 */
export async function cancelSalesOrder(
  supabase: any,
  order: SalesOrderRow,
  userId: string | null
): Promise<SaleCancelResult> {
  if (order.status === 'cancelled') throw new SaleCancelError('already_cancelled')

  const [
    { data: fullOrder, error: orderError },
    { data: items, error: itemsError },
    { data: invoices, error: invoicesError },
    { data: incomeTxs, error: txError },
  ] = await Promise.all([
    supabase.from('sales_orders').select('id, order_number, status, notes, customer_id').eq('id', order.id).single(),
    supabase.from('sales_order_items').select('product_id, quantity, unit_cost').eq('order_id', order.id),
    supabase.from('invoices').select('id, status, paid_amount, notes').eq('order_id', order.id),
    supabase
      .from('transactions')
      .select('amount')
      .eq('reference_type', 'sales_orders')
      .eq('reference_id', order.id)
      .eq('type', 'income'),
  ])
  if (orderError) throw new Error(orderError.message)
  if (itemsError) throw new Error(itemsError.message)
  if (invoicesError) throw new Error(invoicesError.message)
  if (txError) throw new Error(txError.message)
  if (fullOrder.status === 'cancelled') throw new SaleCancelError('already_cancelled')

  const orderNumber = fullOrder.order_number ?? order.order_number ?? ''
  const liveInvoices = (
    (invoices ?? []) as { id: string; status: string; paid_amount: number | null; notes: string | null }[]
  ).filter((inv) => inv.status !== 'cancelled')

  // Only a cash/card/transfer sale writes an income transaction, and its amount
  // is exactly what went into the cashbox. A debt sale has none.
  const refund = ((incomeTxs ?? []) as { amount: number }[]).reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  )
  // Anything paid on the invoice beyond that came from the customer's credit or
  // from debt collected later.
  const paidOnInvoices = liveInvoices.reduce((sum, inv) => sum + (Number(inv.paid_amount) || 0), 0)
  const creditToRestore = fullOrder.customer_id ? Math.max(0, paidOnInvoices - refund) : 0

  let cashbox: { id: string; name: string; balance: number } | null = null
  if (refund > 0) {
    const method = salePaymentMethod([fullOrder.notes, ...liveInvoices.map((inv) => inv.notes)])
    cashbox = await findSaleCashbox(supabase, method)
    if (!cashbox || cashbox.balance < refund) {
      throw new SaleCancelError('insufficient_cashbox', {
        cashboxName: cashbox?.name,
        balance: cashbox?.balance ?? 0,
        amount: refund,
      })
    }
  }

  // Claim the cancellation. Filtering on the status turns a second, concurrent
  // cancel into a no-op that stops here instead of reversing everything again.
  const { data: claimed, error: statusError } = await supabase
    .from('sales_orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id)
    .neq('status', 'cancelled')
    .select('id')
  if (statusError) throw new Error(statusError.message)
  if (!claimed?.length) throw new SaleCancelError('already_cancelled')

  // Money first: it is the one step that can still refuse (someone took money
  // out of the drawer since the check above).
  if (cashbox && refund > 0) {
    await withdrawFromCashbox(supabase, cashbox.id, refund)
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('reference_type', 'sales_orders')
      .eq('reference_id', order.id)
      .eq('type', 'income')
    if (error) throw new Error(error.message)
  }

  await returnLinesToStock(supabase, {
    orderId: order.id,
    lines: (items ?? []) as SoldLine[],
    reason: `Cancelled order ${orderNumber}`.trim(),
    userId,
  })

  if (creditToRestore > 0 && fullOrder.customer_id) {
    const { data: customer, error: readError } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', fullOrder.customer_id)
      .single()
    if (readError) throw new Error(readError.message)
    const { error: creditError } = await supabase
      .from('customers')
      .update({ credit_balance: (Number(customer?.credit_balance) || 0) + creditToRestore })
      .eq('id', fullOrder.customer_id)
    if (creditError) throw new Error(creditError.message)
  }

  // Last: a cancelled invoice drops out of the customer's debt and every
  // receivables figure.
  if (liveInvoices.length > 0) {
    const { error: invoiceError } = await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .in('id', liveInvoices.map((inv) => inv.id))
    if (invoiceError) throw new Error(invoiceError.message)
  }

  return { refunded: refund, cashboxName: cashbox?.name ?? null, creditRestored: creditToRestore }
}

/**
 * Invoice status write. `paid` is deliberately NOT settable here: a payment has
 * to land in a cashbox and create a transaction, which is what the invoice
 * detail page's "accept payment" and Finance → Cashbox already do.
 */
export async function setInvoiceStatus(
  supabase: any,
  invoiceId: string,
  status: Exclude<InvoiceStatus, 'paid' | 'overdue'>
): Promise<void> {
  const { error } = await supabase.from('invoices').update({ status }).eq('id', invoiceId)
  if (error) throw new Error(error.message)
}
