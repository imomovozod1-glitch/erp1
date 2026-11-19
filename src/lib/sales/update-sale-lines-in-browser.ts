import { depositToCashbox, findSaleCashbox, withdrawFromCashbox } from '@/lib/finance/cashbox-balance'
import { isoDate } from '@/lib/utils'
import { returnLinesToStock } from './return-to-stock'
import { salePaymentMethod } from './sale-cancel'
import { planLineEdits, round2, saleLineTotal, saleOrderTotal, SaleEditError, unchanged, type ItemRow, type SaleEditResult, type SaleLineEdit } from './sale-edit-model'
import { addToCustomerCredit, raise } from './sale-writes'

// Pre-migration fallback for `update_sale_lines`: the same edit as separate browser
// writes. Remove once migration_business_rpc.sql is applied everywhere.

interface InvoiceRow {
  id: string
  status: string
  total_amount: number
  paid_amount: number | null
  paid_at: string | null
  notes: string | null
}

async function readSale(supabase: any, orderId: string) {
  const [order, items, invoices, income] = await Promise.all([
    supabase.from('sales_orders').select('id, order_number, status, notes, customer_id, total_amount, discount_amount, tax_amount').eq('id', orderId).single(),
    supabase.from('sales_order_items').select('id, product_id, quantity, unit_price, unit_cost, discount_percent').eq('order_id', orderId),
    supabase.from('invoices').select('id, status, total_amount, paid_amount, paid_at, notes').eq('order_id', orderId).neq('status', 'cancelled').order('created_at', { ascending: true }),
    supabase.from('transactions').select('id, amount').eq('reference_type', 'sales_orders').eq('reference_id', orderId).eq('type', 'income').order('created_at', { ascending: true }),
  ])
  ;[order, items, invoices, income].forEach((result) => raise(result.error))
  if (order.data.status === 'cancelled') throw new SaleEditError('order_cancelled')
  return {
    order: order.data,
    rows: (items.data ?? []) as ItemRow[],
    invoices: (invoices.data ?? []) as InvoiceRow[],
    income: (income.data ?? []) as { id: string; amount: number }[],
  }
}

type Sale = Awaited<ReturnType<typeof readSale>>

async function cashboxFor(supabase: any, sale: Sale, delta: number) {
  if (!sale.income.length || delta === 0) return null
  const cashbox = await findSaleCashbox(supabase, salePaymentMethod([sale.order.notes, ...sale.invoices.map((inv) => inv.notes)]))
  if (!cashbox || (delta < 0 && cashbox.balance < -delta)) {
    throw new SaleEditError('insufficient_cashbox', { cashboxName: cashbox?.name, balance: cashbox?.balance ?? 0, amount: -delta })
  }
  return cashbox
}

async function writeLines(supabase: any, sale: Sale, plan: ReturnType<typeof planLineEdits>, userId: string | null) {
  for (const { row, unitPrice } of plan.repriced) {
    const total_price = saleLineTotal(unitPrice, Number(row.quantity) || 0, row.discount_percent)
    raise((await supabase.from('sales_order_items').update({ unit_price: unitPrice, total_price }).eq('id', row.id)).error)
  }
  if (!plan.removed.length) return
  const reason = `Removed from order ${sale.order.order_number ?? ''}`.trim()
  await returnLinesToStock(supabase, { orderId: sale.order.id, lines: plan.removed, reason, userId })
  raise((await supabase.from('sales_order_items').delete().in('id', plan.removed.map((row) => row.id))).error)
}

async function settleCashSale(supabase: any, sale: Sale, cashbox: { id: string } | null, delta: number, newTotal: number) {
  if (cashbox && delta < 0) await withdrawFromCashbox(supabase, cashbox.id, -delta)
  if (cashbox && delta > 0) await depositToCashbox(supabase, cashbox.id, delta)
  if (delta !== 0) {
    const first = sale.income[0]
    const corrected = round2((Number(first.amount) || 0) + delta)
    const query = corrected > 0 ? supabase.from('transactions').update({ amount: corrected }) : supabase.from('transactions').delete()
    raise((await query.eq('id', first.id)).error)
  }
  const invoice = sale.invoices[0]
  if (invoice) raise((await supabase.from('invoices').update({ total_amount: newTotal, paid_amount: newTotal }).eq('id', invoice.id)).error)
}

// The customer's debt is `total_amount - paid_amount` on the invoice; anything paid beyond the new total becomes credit.
async function settleDebtSale(supabase: any, sale: Sale, newTotal: number) {
  const invoice = sale.invoices[0]
  if (!invoice) return 0
  const paidBefore = Number(invoice.paid_amount) || 0
  const paid = Math.min(paidBefore, newTotal)
  const fullyPaid = paid >= newTotal
  raise(
    (
      await supabase
        .from('invoices')
        .update({
          total_amount: newTotal,
          paid_amount: paid,
          status: fullyPaid ? 'paid' : invoice.status === 'paid' ? 'sent' : invoice.status,
          paid_at: fullyPaid ? (invoice.paid_at ?? isoDate()) : null,
        })
        .eq('id', invoice.id)
    ).error
  )
  const excess = sale.order.customer_id ? round2(paidBefore - paid) : 0
  await addToCustomerCredit(supabase, sale.order.customer_id, excess)
  return excess
}

export async function updateSaleLinesInBrowser(supabase: any, orderId: string, edits: SaleLineEdit[], userId: string | null): Promise<SaleEditResult> {
  const sale = await readSale(supabase, orderId)
  const plan = planLineEdits(sale.rows, edits)
  const oldTotal = Number(sale.order.total_amount) || 0
  if (!plan.removed.length && !plan.repriced.length) return unchanged(oldTotal)
  if (!plan.keptTotals.length) throw new SaleEditError('no_lines_left')

  const { total: newTotal, discount } = saleOrderTotal(plan.keptTotals, sale.order.discount_amount, sale.order.tax_amount)
  const delta = round2(newTotal - oldTotal)
  const cashbox = await cashboxFor(supabase, sale, delta)
  await writeLines(supabase, sale, plan, userId)
  raise((await supabase.from('sales_orders').update({ total_amount: newTotal, discount_amount: discount }).eq('id', orderId)).error)

  const isCashSale = sale.income.length > 0
  if (isCashSale) await settleCashSale(supabase, sale, cashbox, delta, newTotal)
  const creditAdded = isCashSale ? 0 : await settleDebtSale(supabase, sale, newTotal)
  return { changed: true, newTotal, cashboxDelta: isCashSale ? delta : 0, cashboxName: cashbox?.name ?? null, creditAdded }
}
