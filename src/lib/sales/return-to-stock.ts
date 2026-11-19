import { recordCostLayer } from '@/lib/inventory-costing'
import { raise } from './sale-writes'

export interface SoldLine {
  product_id: string
  quantity: number
  unit_cost: number | null
}

interface ReturnInput {
  orderId: string
  lines: SoldLine[]
  reason: string
  userId: string | null
}

function groupByProduct(lines: SoldLine[]) {
  const groups = new Map<string, SoldLine[]>()
  for (const line of lines) groups.set(line.product_id, [...(groups.get(line.product_id) ?? []), line])
  return groups
}

async function freshStock(supabase: any, productIds: string[]) {
  const { data, error } = await supabase.from('products').select('id, stock').in('id', productIds)
  raise(error)
  return new Map<string, number>((data ?? []).map((p: { id: string; stock: number }) => [p.id, Number(p.stock) || 0]))
}

async function returnLine(supabase: any, line: SoldLine, before: number, input: ReturnInput) {
  const quantity = Number(line.quantity) || 0
  const after = before + quantity
  const unitCost = line.unit_cost == null ? null : Number(line.unit_cost) || 0
  const [stock, movement] = await Promise.all([
    supabase.from('products').update({ stock: after }).eq('id', line.product_id),
    supabase.from('stock_movements').insert({
      product_id: line.product_id,
      type: 'in',
      quantity,
      quantity_before: before,
      quantity_after: after,
      reference_type: 'sales_orders',
      reference_id: input.orderId,
      reason: input.reason,
      unit_cost: unitCost,
      total_cost: unitCost == null ? null : unitCost * quantity,
      created_by: input.userId,
    }),
  ])
  raise(stock.error)
  raise(movement.error)
  if (unitCost != null) {
    await recordCostLayer(supabase, { productId: line.product_id, quantity, unitCost, sourceType: 'sale_cancellation', sourceId: input.orderId })
  }
  return after
}

/**
 * Puts sold lines back on the shelf from a fresh stock read: an `in` movement per line
 * and a cost layer at the cost the sale was charged. Products run in parallel; lines of
 * one product run in order so their before/after figures chain.
 */
export async function returnLinesToStock(supabase: any, input: ReturnInput) {
  if (!input.lines.length) return
  const groups = groupByProduct(input.lines)
  const stockById = await freshStock(supabase, [...groups.keys()])
  await Promise.all(
    [...groups].map(async ([productId, lines]) => {
      let before = stockById.get(productId)
      if (before === undefined) return
      for (const line of lines) before = await returnLine(supabase, line, before, input)
    })
  )
}
