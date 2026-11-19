import { findSaleCashbox, withdrawFromCashbox } from '@/lib/finance/cashbox-balance'
import { SaleCancelError, salePaymentMethod, type SaleCancelResult, type SalesOrderRow } from './sale-cancel'
import { returnLinesToStock, type SoldLine } from './return-to-stock'
import { addToCustomerCredit, raise } from './sale-writes'

// Pre-migration fallback for `cancel_sales_order`: the same reversal as separate browser
// writes. Remove once migration_business_rpc.sql is applied everywhere.

interface LiveInvoice {
  id: string
  status: string
  paid_amount: number | null
  notes: string | null
}

const amountSum = <T,>(rows: T[], pick: (row: T) => unknown) => rows.reduce((sum, row) => sum + (Number(pick(row)) || 0), 0)

async function readSale(supabase: any, orderId: string) {
  const [order, items, invoices, income] = await Promise.all([
    supabase.from('sales_orders').select('id, order_number, status, notes, customer_id').eq('id', orderId).single(),
    supabase.from('sales_order_items').select('product_id, quantity, unit_cost').eq('order_id', orderId),
    supabase.from('invoices').select('id, status, paid_amount, notes').eq('order_id', orderId),
    supabase.from('transactions').select('amount').eq('reference_type', 'sales_orders').eq('reference_id', orderId).eq('type', 'income'),
  ])
  ;[order, items, invoices, income].forEach((result) => raise(result.error))
  if (order.data.status === 'cancelled') throw new SaleCancelError('already_cancelled')
  const live = ((invoices.data ?? []) as LiveInvoice[]).filter((inv) => inv.status !== 'cancelled')
  return { order: order.data, items: (items.data ?? []) as SoldLine[], invoices: live, refund: amountSum(income.data ?? [], (tx: any) => tx.amount) }
}

async function refundCashbox(supabase: any, sale: Awaited<ReturnType<typeof readSale>>) {
  if (sale.refund <= 0) return null
  const cashbox = await findSaleCashbox(supabase, salePaymentMethod([sale.order.notes, ...sale.invoices.map((inv) => inv.notes)]))
  if (!cashbox || cashbox.balance < sale.refund) {
    throw new SaleCancelError('insufficient_cashbox', { cashboxName: cashbox?.name, balance: cashbox?.balance ?? 0, amount: sale.refund })
  }
  return cashbox
}

async function claimCancellation(supabase: any, orderId: string) {
  const { data, error } = await supabase.from('sales_orders').update({ status: 'cancelled' }).eq('id', orderId).neq('status', 'cancelled').select('id')
  raise(error)
  if (!data?.length) throw new SaleCancelError('already_cancelled')
}

async function withdrawRefund(supabase: any, orderId: string, cashboxId: string, amount: number) {
  await withdrawFromCashbox(supabase, cashboxId, amount)
  const { error } = await supabase.from('transactions').delete().eq('reference_type', 'sales_orders').eq('reference_id', orderId).eq('type', 'income')
  raise(error)
}

async function cancelInvoices(supabase: any, invoices: LiveInvoice[]) {
  if (!invoices.length) return
  const { error } = await supabase.from('invoices').update({ status: 'cancelled' }).in('id', invoices.map((inv) => inv.id))
  raise(error)
}

export async function cancelSalesOrderInBrowser(supabase: any, row: SalesOrderRow, userId: string | null): Promise<SaleCancelResult> {
  const sale = await readSale(supabase, row.id)
  const credit = sale.order.customer_id ? Math.max(0, amountSum(sale.invoices, (inv) => inv.paid_amount) - sale.refund) : 0
  const cashbox = await refundCashbox(supabase, sale)
  await claimCancellation(supabase, row.id)
  if (cashbox) await withdrawRefund(supabase, row.id, cashbox.id, sale.refund)
  const orderNumber = sale.order.order_number ?? row.order_number ?? ''
  await Promise.all([
    returnLinesToStock(supabase, { orderId: row.id, lines: sale.items, reason: `Cancelled order ${orderNumber}`.trim(), userId }),
    addToCustomerCredit(supabase, sale.order.customer_id, credit),
    cancelInvoices(supabase, sale.invoices),
  ])
  return { refunded: sale.refund, cashboxName: cashbox?.name ?? null, creditRestored: credit }
}
