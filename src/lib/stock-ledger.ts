import {
  consumeCostLayers,
  getEffectiveCostingMethod,
  recordCostLayer,
  type CostLayerSourceType,
  type CostingMethod,
} from '@/lib/inventory-costing'

export interface StockChange {
  productId: string
  before: number
  after: number
  unitCost: number
  layerSource: CostLayerSourceType
  referenceType: string
  reason: string
  userId: string | null
}

type MethodSource = CostingMethod | (() => Promise<CostingMethod>)

export async function tenantCostingMethod(supabase: any): Promise<CostingMethod> {
  const { data } = await supabase.from('tenants').select('costing_method').limit(1).single()
  return getEffectiveCostingMethod(data)
}

async function costChange(supabase: any, change: StockChange, method: MethodSource) {
  const diff = change.after - change.before
  if (diff < 0) {
    const resolved = typeof method === 'function' ? await method() : method
    return consumeCostLayers(supabase, change.productId, -diff, resolved)
  }
  await recordCostLayer(supabase, {
    productId: change.productId,
    quantity: diff,
    unitCost: change.unitCost,
    sourceType: change.layerSource,
  })
  return { unitCost: change.unitCost, totalCost: diff * change.unitCost }
}

/**
 * Files a manual stock change in the ledger: a cost layer for stock coming in (or
 * layers consumed under the tenant's method for stock going out) and the movement row.
 * A failed movement insert is logged, never thrown — the product itself is already saved.
 */
export async function recordStockChange(supabase: any, change: StockChange, method: MethodSource = 'fifo') {
  const diff = change.after - change.before
  if (diff === 0) return
  const { unitCost, totalCost } = await costChange(supabase, change, method)
  const { error } = await supabase.from('stock_movements').insert({
    product_id: change.productId,
    type: diff > 0 ? 'in' : 'out',
    quantity: Math.abs(diff),
    quantity_before: change.before,
    quantity_after: change.after,
    reference_type: change.referenceType,
    reason: change.reason,
    unit_cost: unitCost,
    total_cost: totalCost,
    created_by: change.userId,
  })
  if (error) console.error('Error inserting stock movement:', error)
}
