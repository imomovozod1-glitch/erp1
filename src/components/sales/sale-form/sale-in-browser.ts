import { adjustCashboxBalance } from '@/lib/finance/cashbox-balance'
import { applyCustomerCredit } from '@/lib/finance/customer-credit'
import { consumeCostLayers, getEffectiveCostingMethod } from '@/lib/inventory-costing'
import { SaleCreateError } from '@/lib/sale-create'
import { formatCurrency } from '@/lib/utils'
import { quantityByProduct, type PaymentMethod, type SaleItem } from './sale-lines'

// Pre-migration fallback: the same sale as separate browser writes.
// Remove once migration_business_rpc.sql (`create_sale`) is applied everywhere.

export interface BrowserSale {
  items: SaleItem[]
  customerId: string
  paymentMethod: PaymentMethod
  assignedTo: string | null
  totalAmount: number
  orderNumber: string
  invoiceNumber: string
  orderDateStr: string
  dueDateStr: string
}

interface Cost {
  unitCost: number
  totalCost: number
}

const throwIfError = ({ error }: { error: unknown }) => {
  if (error) throw error
}

async function readFreshStock(supabase: any, items: SaleItem[]) {
  const [{ data, error }, { data: tenant }] = await Promise.all([
    supabase.from('products').select('id, stock, name').in('id', items.map((i) => i.productId)),
    supabase.from('tenants').select('costing_method').limit(1).single(),
  ])
  if (error) throw error
  return { stockById: new Map<string, number>((data ?? []).map((p: any) => [p.id, Number(p.stock)])), tenant }
}

function assertStock(items: SaleItem[], totals: Map<string, number>, stockById: Map<string, number>) {
  for (const [productId, quantity] of totals) {
    const available = stockById.get(productId)
    if (available !== undefined && available >= quantity) continue
    const productName = items.find((i) => i.productId === productId)?.productName ?? ''
    throw new SaleCreateError('insufficient_stock', { productId, productName, available: available ?? 0 })
  }
}

async function insertOrder(supabase: any, sale: BrowserSale, userId: string) {
  const { data, error } = await supabase
    .from('sales_orders')
    .insert([{
      order_number: sale.orderNumber,
      customer_id: sale.customerId || null,
      status: 'confirmed',
      total_amount: sale.totalAmount,
      created_by: userId,
      assigned_to: sale.assignedTo ?? userId,
    }])
    .select()
    .single()
  if (error) throw error
  return data as { id: string }
}

async function costByProduct(supabase: any, totals: Map<string, number>, tenant: unknown) {
  const method = getEffectiveCostingMethod(tenant as any)
  const ids = [...totals.keys()]
  const costs = await Promise.all(ids.map((id) => consumeCostLayers(supabase, id, totals.get(id) as number, method)))
  return new Map<string, Cost>(ids.map((id, i) => [id, costs[i]]))
}

function stockWrites(sale: BrowserSale, orderId: string, stockById: Map<string, number>, costs: Map<string, Cost>, userId: string) {
  const movements: Record<string, unknown>[] = []
  const finalStock = new Map<string, number>()
  for (const item of sale.items) {
    const before = finalStock.get(item.productId) ?? stockById.get(item.productId)
    if (before === undefined) continue
    const after = before - item.quantity
    const cost = costs.get(item.productId)
    finalStock.set(item.productId, after)
    movements.push({
      product_id: item.productId,
      type: 'out',
      quantity: item.quantity,
      quantity_before: before,
      quantity_after: after,
      reference_type: 'sales_orders',
      reference_id: orderId,
      reason: `Sale ${sale.orderNumber}`,
      unit_cost: cost?.unitCost ?? null,
      total_cost: cost ? cost.unitCost * item.quantity : null,
      created_by: userId,
    })
  }
  return { movements, finalStock }
}

async function writeLinesAndStock(supabase: any, sale: BrowserSale, orderId: string, stockById: Map<string, number>, costs: Map<string, Cost>, userId: string) {
  const { movements, finalStock } = stockWrites(sale, orderId, stockById, costs, userId)
  const lines = sale.items.map((item) => ({
    order_id: orderId,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    unit_cost: costs.get(item.productId)?.unitCost ?? null,
    total_price: item.totalPrice,
  }))
  const results = await Promise.all([
    supabase.from('sales_order_items').insert(lines),
    supabase.from('stock_movements').insert(movements),
    ...[...finalStock].map(([id, stock]) => supabase.from('products').update({ stock }).eq('id', id)),
  ])
  results.forEach(throwIfError)
}

function invoiceRow(sale: BrowserSale, orderId: string, appliedCredit: number, userId: string) {
  const debt = sale.paymentMethod === 'debt'
  const paid = !debt || appliedCredit >= sale.totalAmount
  const creditNote = appliedCredit > 0 ? ` (${formatCurrency(appliedCredit)} haqdorlikdan to'landi)` : ''
  return {
    invoice_number: sale.invoiceNumber,
    order_id: orderId,
    customer_id: sale.customerId || null,
    status: paid ? 'paid' : 'sent',
    total_amount: sale.totalAmount,
    paid_amount: debt ? appliedCredit : sale.totalAmount,
    issued_at: sale.orderDateStr,
    due_at: sale.dueDateStr,
    paid_at: paid ? sale.orderDateStr : null,
    notes: debt ? `Qarzga sotildi - Order #${sale.orderNumber}${creditNote}` : `Paid via ${sale.paymentMethod}`,
    created_by: userId,
    assigned_to: sale.assignedTo ?? userId,
  }
}

async function recordIncome(supabase: any, sale: BrowserSale, orderId: string, userId: string) {
  const income = {
    type: 'income',
    amount: sale.totalAmount,
    category: 'Sales',
    description: `Sale - Order #${sale.orderNumber}`,
    reference_type: 'sales_orders',
    reference_id: orderId,
    transaction_date: sale.orderDateStr,
    created_by: userId,
  }
  const kind = sale.paymentMethod as 'cash' | 'card' | 'transfer'
  const [inserted] = await Promise.all([
    supabase.from('transactions').insert(income),
    adjustCashboxBalance(sale.totalAmount, 'income', supabase, kind),
  ])
  throwIfError(inserted)
}

async function settlePayment(supabase: any, sale: BrowserSale, orderId: string, userId: string) {
  const debt = sale.paymentMethod === 'debt'
  const credit = debt && sale.customerId ? await applyCustomerCredit(supabase, sale.customerId, sale.totalAmount) : null
  const [invoice] = await Promise.all([
    supabase.from('invoices').insert(invoiceRow(sale, orderId, credit?.appliedCredit ?? 0, userId)),
    !debt && sale.totalAmount > 0 ? recordIncome(supabase, sale, orderId, userId) : null,
  ])
  throwIfError(invoice)
}

export async function submitSaleInBrowser(supabase: any, sale: BrowserSale) {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) throw new Error('unauthorized')
  const totals = quantityByProduct(sale.items)
  const { stockById, tenant } = await readFreshStock(supabase, sale.items)
  assertStock(sale.items, totals, stockById)
  const order = await insertOrder(supabase, sale, userId)
  const costs = await costByProduct(supabase, totals, tenant)
  await writeLinesAndStock(supabase, sale, order.id, stockById, costs, userId)
  await settlePayment(supabase, sale, order.id, userId)
}
