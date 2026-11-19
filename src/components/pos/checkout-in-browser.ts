import { adjustCashboxBalance } from '@/lib/finance/cashbox-balance'
import { applyCustomerCredit } from '@/lib/finance/customer-credit'
import { consumeCostLayers, getEffectiveCostingMethod } from '@/lib/inventory-costing'
import { formatCurrency } from '@/lib/utils'
import { debtDueDate, PosSaleError, type PosSaleInput, type PosSaleResult } from '@/components/pos/checkout-shared'
import { lineTotal } from '@/components/pos/pos-sale-model'
import type { CartItem } from '@/components/pos/use-pos-cart'

/**
 * Pre-migration fallback: the same sale as separate browser writes.
 * Remove once migration_business_rpc.sql is applied everywhere.
 */

type Cost = { unitCost: number; totalCost: number }

const ok = ({ error }: { error: unknown }) => {
  if (error) throw error
}

// getSession() reads the JWT in memory; the id only stamps created_by — the database checks the token itself.
async function cashierId(supabase: any, message: string) {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.user) throw new PosSaleError(message)
  return data.session.user.id as string
}

/** Validated against the stock the database holds now, not the copy the till was loaded with. */
async function readStock(supabase: any, items: CartItem[], message: string) {
  const [{ data: rows }, { data: tenant }] = await Promise.all([
    supabase.from('products').select('id, stock').in('id', items.map((item) => item.product.id)),
    supabase.from('tenants').select('costing_method').limit(1).single(),
  ])
  const stockBefore = new Map<string, number>((rows || []).map((p: any) => [p.id, Number(p.stock)]))
  const short = items.find((item) => (stockBefore.get(item.product.id) ?? -1) < item.quantity)
  if (short) throw new PosSaleError(`${message}: ${short.product.name}`)
  return { stockBefore, method: getEffectiveCostingMethod(tenant) }
}

// A counter sale is finished the moment it is rung up, and owned by the cashier who rang it.
async function insertOrder(supabase: any, input: PosSaleInput, userId: string, orderDate: string) {
  const { data, error } = await supabase
    .from('sales_orders')
    .insert({
      order_number: input.orderNumber,
      customer_id: input.customer?.id ?? null,
      status: 'delivered',
      total_amount: input.totals.total,
      discount_amount: input.totals.discount,
      tax_amount: input.totals.tax,
      notes: `POS Sale - Paid via ${input.paymentMethod.toUpperCase()}`,
      created_by: userId,
      assigned_to: userId,
      order_date: orderDate,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// A basket never holds a product twice, so each line's layers are independent and consumed in parallel.
async function costLines(supabase: any, items: CartItem[], method: ReturnType<typeof getEffectiveCostingMethod>) {
  const consumed = await Promise.all(items.map((item) => consumeCostLayers(supabase, item.product.id, item.quantity, method)))
  return new Map<string, Cost>(items.map((item, i) => [item.product.id, consumed[i]]))
}

function lineWrites(supabase: any, items: CartItem[], order: any, costs: Map<string, Cost>, stockBefore: Map<string, number>, userId: string) {
  const lines = items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    quantity: item.quantity,
    unit_price: item.product.price,
    unit_cost: costs.get(item.product.id)?.unitCost ?? null,
    discount_percent: item.discountPercent,
    total_price: lineTotal(item),
  }))
  const stock = items.flatMap((item) => {
    const before = stockBefore.get(item.product.id) as number
    const after = before - item.quantity
    const cost = costs.get(item.product.id)
    return [
      supabase.from('products').update({ stock: after }).eq('id', item.product.id).then(ok),
      supabase
        .from('stock_movements')
        .insert({
          product_id: item.product.id, type: 'out', quantity: item.quantity, quantity_before: before, quantity_after: after,
          reference_type: 'sales_orders', reference_id: order.id, reason: 'POS Sale',
          unit_cost: cost?.unitCost ?? null, total_cost: cost?.totalCost ?? null, created_by: userId,
        })
        .then(ok),
    ]
  })
  return [supabase.from('sales_order_items').insert(lines).then(ok), ...stock]
}

// Paid now: income + cashbox. A debt sale books income only when the debt is collected.
function moneyWrites(supabase: any, input: PosSaleInput, order: any, userId: string, orderDate: string) {
  const { totals, paymentMethod } = input
  if (paymentMethod === 'debt' || totals.total <= 0) return []
  return [
    supabase
      .from('transactions')
      .insert({
        type: 'income', amount: totals.total, category: 'Sales', description: `POS Sale - Order #${order.order_number}`,
        reference_type: 'sales_orders', reference_id: order.id, transaction_date: orderDate, created_by: userId,
      })
      .then(ok),
    adjustCashboxBalance(totals.total, 'income', supabase, paymentMethod),
  ]
}

function invoiceWrite(supabase: any, input: PosSaleInput, order: any, extra: { userId: string; orderDate: string; invoiceNumber: string; credit: number }) {
  const debt = input.paymentMethod === 'debt'
  const settled = !debt || extra.credit >= input.totals.total
  const creditNote = extra.credit > 0 ? ` (${formatCurrency(extra.credit)} haqdorlikdan to'landi)` : ''
  return supabase
    .from('invoices')
    .insert({
      invoice_number: extra.invoiceNumber,
      order_id: order.id,
      customer_id: input.customer?.id ?? null,
      status: settled ? 'paid' : 'sent',
      total_amount: input.totals.total,
      paid_amount: debt ? extra.credit : input.totals.total,
      issued_at: extra.orderDate,
      due_at: debt ? debtDueDate() : extra.orderDate,
      paid_at: settled ? extra.orderDate : null,
      notes: debt ? `Qarzga sotildi - POS Order #${order.order_number}${creditNote}` : `Paid instantly on POS via ${input.paymentMethod}`,
      created_by: extra.userId,
      assigned_to: extra.userId,
    })
    .then(ok)
}

export async function submitPosSaleInBrowser(input: PosSaleInput, invoiceNumber: string, orderDate: string): Promise<PosSaleResult> {
  const { supabase, items, customer, paymentMethod, totals, messages } = input
  const userId = await cashierId(supabase, messages.sessionNotFound)
  const { stockBefore, method } = await readStock(supabase, items, messages.insufficientStock)
  const order = await insertOrder(supabase, input, userId, orderDate)
  const costs = await costLines(supabase, items, method)
  // Credit already on file is spent first, or the customer would hold credit and a fresh debt at once.
  const credit = paymentMethod === 'debt' && customer ? (await applyCustomerCredit(supabase, customer.id, totals.total)).appliedCredit : 0
  await Promise.all([
    ...lineWrites(supabase, items, order, costs, stockBefore, userId),
    ...moneyWrites(supabase, input, order, userId, orderDate),
    invoiceWrite(supabase, input, order, { userId, orderDate, invoiceNumber, credit }),
  ])
  return { orderId: order.id, invoiceNumber, orderDate, stockBefore, appliedCredit: credit }
}
