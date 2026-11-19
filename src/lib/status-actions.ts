'use client'

import type { OrderStatus, InvoiceStatus } from '@/lib/statuses'
import { callBusinessRpc, RPC_MISSING } from '@/lib/business-rpc'
import { cancelSalesOrderInBrowser } from '@/lib/sales/cancel-sale-in-browser'

import { SaleCancelError, type SaleCancelResult, type SalesOrderRow } from '@/lib/sales/sale-cancel'

export { returnLinesToStock, type SoldLine } from '@/lib/sales/return-to-stock'
export { SaleCancelError, salePaymentMethod, type SaleCancelResult, type SaleCashboxType, type SalesOrderRow } from '@/lib/sales/sale-cancel'

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

/**
 * Plain status move, for transitions with no stock or money consequences.
 * `set_order_status` checks the transition and the caller's permission and
 * throws `BusinessRpcError` on a refusal.
 */
export async function setOrderStatus(
  supabase: any,
  orderId: string,
  status: Exclude<OrderStatus, 'cancelled'>
): Promise<void> {
  const result = await callBusinessRpc(supabase, 'set_order_status', { p_order_id: orderId, p_status: status })
  if (result !== RPC_MISSING) return
  // Pre-migration fallback.
  const { error } = await supabase.from('sales_orders').update({ status }).eq('id', orderId)
  if (error) throw new Error(error.message, { cause: error })
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
 * Unlike the rest of the app's writes this is one database transaction — the
 * `cancel_sales_order` Postgres function — so a failure part-way leaves nothing
 * half-reversed, and the order and cashbox rows stay locked while it runs.
 * Refusals (already cancelled, cashbox no longer holds the money) come back as
 * a `SaleCancelError` with nothing written.
 */
export async function cancelSalesOrder(
  supabase: any,
  order: SalesOrderRow,
  userId: string | null
): Promise<SaleCancelResult> {
  if (order.status === 'cancelled') throw new SaleCancelError('already_cancelled')

  // The whole reversal runs in one database transaction
  // (supabase/migration_business_rpc.sql).
  const { data, error } = await supabase.rpc('cancel_sales_order', { p_order_id: order.id })
  if (error) {
    // PGRST202 = the function does not exist yet: migrations are applied by
    // hand, so a deploy can land before it. Fall back to the browser path
    // until it is applied — then this branch and the function below can go.
    if (error.code === 'PGRST202') return cancelSalesOrderInBrowser(supabase, order, userId)
    throw new Error(error.message, { cause: error })
  }

  const result = data as {
    ok: boolean
    code?: 'forbidden' | 'not_found' | 'already_cancelled' | 'insufficient_cashbox'
    refunded?: number
    cashbox_name?: string | null
    credit_restored?: number
    balance?: number
    amount?: number
  }
  if (!result.ok) {
    if (result.code === 'forbidden') throw new SaleCancelError('forbidden')
    if (result.code === 'insufficient_cashbox') {
      throw new SaleCancelError('insufficient_cashbox', {
        cashboxName: result.cashbox_name ?? undefined,
        balance: Number(result.balance) || 0,
        amount: Number(result.amount) || 0,
      })
    }
    // `not_found` only happens when the sale was deleted meanwhile (or is
    // another tenant's); either way there is nothing left to cancel here.
    throw new SaleCancelError('already_cancelled')
  }

  return {
    refunded: Number(result.refunded) || 0,
    cashboxName: result.cashbox_name ?? null,
    creditRestored: Number(result.credit_restored) || 0,
  }
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
  const result = await callBusinessRpc(supabase, 'set_invoice_status', { p_invoice_id: invoiceId, p_status: status })
  if (result !== RPC_MISSING) return
  // Pre-migration fallback.
  const { error } = await supabase.from('invoices').update({ status }).eq('id', invoiceId)
  if (error) throw new Error(error.message, { cause: error })
}
