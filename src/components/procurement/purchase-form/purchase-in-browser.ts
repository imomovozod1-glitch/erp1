import { recordCostLayer } from '@/lib/inventory-costing'
import type { PurchaseLine } from './purchase-lines'

// Pre-migration fallback for `receive_purchase`: the purchase as separate browser
// writes. It cannot move money, so it only runs for purchases on account.

export interface BrowserPurchase {
  poNumber: string
  supplierId: string
  supplierName: string
  notes: string
  assignedTo: string | null
  lines: PurchaseLine[]
  total: number
}

async function insertOrder(supabase: any, purchase: BrowserPurchase, userId: string) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert([{
      po_number: purchase.poNumber,
      supplier_id: purchase.supplierId,
      status: 'received',
      total_amount: purchase.total,
      notes: purchase.notes,
      created_by: userId,
      assigned_to: purchase.assignedTo ?? userId,
    }])
    .select()
    .single()
  if (error) throw error
  return data as { id: string }
}

async function insertLines(supabase: any, orderId: string, lines: PurchaseLine[]) {
  const rows = lines.map((line) => ({
    po_id: orderId,
    product_id: line.productId,
    quantity: line.quantity,
    unit_cost: line.unitCost,
    received_qty: line.quantity,
    total_cost: line.totalCost,
  }))
  const { error } = await supabase.from('purchase_order_items').insert(rows)
  if (error) throw error
}

async function freshStock(supabase: any, lines: PurchaseLine[]) {
  const { data, error } = await supabase.from('products').select('id, stock').in('id', lines.map((l) => l.productId))
  if (error) throw error
  return new Map<string, number>((data ?? []).map((p: any) => [p.id, Number(p.stock)]))
}

async function receiveLine(supabase: any, line: PurchaseLine, before: number, orderId: string, purchase: BrowserPurchase, userId: string) {
  const after = before + line.quantity
  await supabase.from('products').update({ stock: after }).eq('id', line.productId)
  await supabase.from('stock_movements').insert([{
    product_id: line.productId,
    type: 'in',
    quantity: line.quantity,
    quantity_before: before,
    quantity_after: after,
    reference_type: 'purchase_order',
    reference_id: orderId,
    reason: `Purchase from ${purchase.supplierName || 'supplier'}`,
    unit_cost: line.unitCost,
    total_cost: line.totalCost,
    created_by: userId,
  }])
  await recordCostLayer(supabase, { productId: line.productId, quantity: line.quantity, unitCost: line.unitCost, sourceType: 'purchase_order', sourceId: orderId })
  return after
}

export async function receivePurchaseInBrowser(supabase: any, purchase: BrowserPurchase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')
  const order = await insertOrder(supabase, purchase, user.id)
  await insertLines(supabase, order.id, purchase.lines)
  // Re-read so a sale or adjustment made since page load is not overwritten; the map
  // stays current so one product on two lines accumulates.
  const stockById = await freshStock(supabase, purchase.lines)
  for (const line of purchase.lines) {
    const before = stockById.get(line.productId)
    if (before === undefined) continue
    stockById.set(line.productId, await receiveLine(supabase, line, before, order.id, purchase, user.id))
  }
}
