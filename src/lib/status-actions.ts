'use client'

import type { OrderStatus, InvoiceStatus } from '@/lib/statuses'

/**
 * Status transitions that have side effects.
 *
 * Everything here runs through the browser Supabase client, the way the rest
 * of the app writes (see CLAUDE.md → Data layer). The point of the module is
 * that a status change is not always "write one column": a sales order already
 * took goods out of stock when it was created, so cancelling it has to put them
 * back, otherwise the warehouse figure silently drifts every time someone
 * cancels an order.
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

/**
 * Cancels a sales order and undoes its stock effect.
 *
 * Order of operations matters: stock is restored from a *fresh* read (the page
 * snapshot can be minutes old and other terminals sell in the meantime), each
 * restore is logged as an `in` movement so the audit trail explains the jump,
 * and only then is the order flipped to `cancelled`. A linked unpaid invoice is
 * cancelled with it — an invoice for goods that were never delivered should not
 * keep showing up as customer debt.
 */
export async function cancelSalesOrder(
  supabase: any,
  order: SalesOrderRow,
  userId: string | null
): Promise<void> {
  if (order.status === 'cancelled') return
  // A delivered order is history: the goods are with the customer, so undoing
  // the stock movement would invent inventory that does not exist.
  if (order.status === 'delivered') {
    throw new Error('delivered_order_cannot_be_cancelled')
  }

  const { data: items, error: itemsError } = await supabase
    .from('sales_order_items')
    .select('product_id, quantity')
    .eq('order_id', order.id)
  if (itemsError) throw new Error(itemsError.message)

  const lines = (items ?? []) as { product_id: string; quantity: number }[]
  if (lines.length > 0) {
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
      if (before === undefined) continue
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

      await supabase.from('stock_movements').insert({
        product_id: line.product_id,
        type: 'in',
        quantity,
        quantity_before: before,
        quantity_after: after,
        reference_type: 'sales_orders',
        reference_id: order.id,
        reason: `Cancelled order ${order.order_number ?? ''}`.trim(),
        created_by: userId,
      })
    }
  }

  const { error: statusError } = await supabase
    .from('sales_orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id)
  if (statusError) throw new Error(statusError.message)

  // Void the invoice raised for this order, unless it was already settled —
  // money that actually changed hands is reversed in Finance, not here.
  await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('order_id', order.id)
    .not('status', 'in', '("paid","cancelled")')
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
