/**
 * FIFO / LIFO / AVECO inventory costing engine.
 *
 * Every stock-IN event (PO receiving, manual stock increase, AI scan of a new
 * product, initial stock, opening balance) records a "cost layer" via
 * `recordCostLayer`. Every stock-OUT event (a sale, a manual stock decrease)
 * draws down those layers via `consumeCostLayers`, which returns the realized
 * unit/total cost to charge for that specific movement — this is what makes
 * profit reporting reflect what was actually paid for the units sold, instead
 * of today's `cost_price` applied retroactively to every past sale.
 *
 * `products.cost_price` is still kept in sync as a live weighted average across
 * remaining layers (see `syncAverageCost`) so every "current state" display that
 * already reads `cost_price` (margin preview while editing, product picker in a
 * sale form, etc.) keeps working unchanged. It is explicitly an *average*,
 * though — under FIFO/LIFO the next sale is charged whatever the oldest/newest
 * layer's own `unit_cost` is, which can differ from that average. Anywhere that
 * distinction actually matters (the product detail page), read the layers
 * directly rather than `cost_price`.
 */

export type CostingMethod = 'fifo' | 'lifo' | 'aveco'

export type CostLayerSourceType =
  | 'purchase_order'
  | 'initial_stock'
  | 'adjustment'
  | 'ai_scan'
  | 'opening_balance'

interface ProductLike {
  costing_method?: CostingMethod | null
}

interface CompanySettingsLike {
  default_costing_method?: CostingMethod | null
}

/** `null` on a product means "inherit the company-wide default"; `'fifo'` is the last-resort default. */
export function getEffectiveCostingMethod(
  product?: ProductLike | null,
  companySettings?: CompanySettingsLike | null
): CostingMethod {
  return product?.costing_method ?? companySettings?.default_costing_method ?? 'fifo'
}

interface RecordCostLayerInput {
  productId: string
  quantity: number
  unitCost: number
  sourceType: CostLayerSourceType
  sourceId?: string | null
  receivedAt?: string
}

/** Recomputes and writes `products.cost_price` as the weighted average unit cost
 *  across all layers that still have stock remaining. Leaves cost_price untouched
 *  if nothing remains (better a slightly stale number than a misleading zero). */
async function syncAverageCost(supabase: any, productId: string): Promise<void> {
  const { data: layers, error } = await supabase
    .from('inventory_cost_layers')
    .select('remaining_qty, unit_cost')
    .eq('product_id', productId)
    .gt('remaining_qty', 0)

  if (error || !layers) {
    console.warn('Failed to recompute average cost:', error?.message)
    return
  }

  const totalQty = layers.reduce((sum: number, l: any) => sum + Number(l.remaining_qty), 0)
  if (totalQty <= 0) return

  const avg =
    layers.reduce((sum: number, l: any) => sum + Number(l.remaining_qty) * Number(l.unit_cost), 0) / totalQty

  const { error: updateErr } = await supabase
    .from('products')
    .update({ cost_price: Math.round(avg * 100) / 100 })
    .eq('id', productId)

  if (updateErr) console.warn('Failed to sync product average cost:', updateErr.message)
}

/** Adds a new cost layer for a stock-IN event, then re-syncs the product's average cost. */
export async function recordCostLayer(supabase: any, input: RecordCostLayerInput): Promise<void> {
  const { productId, quantity, unitCost, sourceType, sourceId, receivedAt } = input
  if (quantity <= 0) return

  const { error } = await supabase.from('inventory_cost_layers').insert({
    product_id: productId,
    quantity,
    remaining_qty: quantity,
    unit_cost: unitCost,
    source_type: sourceType,
    source_id: sourceId ?? null,
    received_at: receivedAt ?? new Date().toISOString(),
  })

  if (error) {
    console.warn('Failed to record cost layer:', error.message)
    return
  }

  await syncAverageCost(supabase, productId)
}

/** Guarded decrement — only succeeds if the layer still has at least `allocated`
 *  remaining at update time, so a concurrent consumption can't push it negative
 *  or double-book the same units (this app has no transactional RPC to make the
 *  whole multi-layer walk atomic; this at least protects each individual row). */
async function decrementLayer(supabase: any, layerId: string, knownRemaining: number, allocated: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('inventory_cost_layers')
    .update({ remaining_qty: knownRemaining - allocated })
    .eq('id', layerId)
    .gte('remaining_qty', allocated)
    .select('id')

  if (error) {
    console.warn('Failed to decrement cost layer:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

export interface ConsumeResult {
  unitCost: number
  totalCost: number
}

/** Draws down cost layers for a stock-OUT event and returns the realized cost to
 *  charge for it. Quantity beyond what any layer can cover (overselling — the app
 *  doesn't hard-block it elsewhere) is costed at the product's last known average
 *  rather than throwing, so it never blocks the sale; a later restock does not
 *  retroactively true up that shortfall. */
export async function consumeCostLayers(
  supabase: any,
  productId: string,
  quantity: number,
  method: CostingMethod
): Promise<ConsumeResult> {
  if (quantity <= 0) return { unitCost: 0, totalCost: 0 }

  const { data: layers, error } = await supabase
    .from('inventory_cost_layers')
    .select('id, remaining_qty, unit_cost')
    .eq('product_id', productId)
    .gt('remaining_qty', 0)
    .order('received_at', { ascending: method !== 'lifo' })

  if (error) {
    console.warn('Failed to fetch cost layers, falling back to product.cost_price:', error.message)
    const { data: product } = await supabase.from('products').select('cost_price').eq('id', productId).single()
    const fallbackUnitCost = Number(product?.cost_price) || 0
    return { unitCost: fallbackUnitCost, totalCost: fallbackUnitCost * quantity }
  }

  const availableLayers = layers ?? []
  let totalCost = 0
  let remainingNeeded = quantity

  if (method === 'aveco') {
    // A moving average charges the same per-unit cost regardless of which physical
    // layer the units are drawn from — compute it once over everything remaining.
    const totalQty = availableLayers.reduce((sum: number, l: any) => sum + Number(l.remaining_qty), 0)
    const avgUnitCost =
      totalQty > 0
        ? availableLayers.reduce((sum: number, l: any) => sum + Number(l.remaining_qty) * Number(l.unit_cost), 0) / totalQty
        : 0
    totalCost = quantity * avgUnitCost

    // Depletion bookkeeping (oldest-first) — doesn't affect the cost charged above,
    // only keeps remaining_qty accurate for future averages/valuation.
    for (const layer of availableLayers) {
      if (remainingNeeded <= 0) break
      const allocated = Math.min(Number(layer.remaining_qty), remainingNeeded)
      if (allocated <= 0) continue
      const ok = await decrementLayer(supabase, layer.id, Number(layer.remaining_qty), allocated)
      if (ok) remainingNeeded -= allocated
    }

    if (remainingNeeded > 0) {
      console.warn(`Oversold product ${productId} by ${remainingNeeded} unit(s) under AVECO — cost still charged at the last known average.`)
    }
  } else {
    // FIFO / LIFO: layers were already fetched in the correct walk order above.
    for (const layer of availableLayers) {
      if (remainingNeeded <= 0) break
      const allocated = Math.min(Number(layer.remaining_qty), remainingNeeded)
      if (allocated <= 0) continue
      const ok = await decrementLayer(supabase, layer.id, Number(layer.remaining_qty), allocated)
      if (!ok) continue
      totalCost += allocated * Number(layer.unit_cost)
      remainingNeeded -= allocated
    }

    if (remainingNeeded > 0) {
      const { data: product } = await supabase.from('products').select('cost_price').eq('id', productId).single()
      const fallbackUnitCost = Number(product?.cost_price) || 0
      totalCost += remainingNeeded * fallbackUnitCost
      console.warn(`Oversold product ${productId} by ${remainingNeeded} unit(s) under ${method.toUpperCase()} — shortfall costed at last known average (${fallbackUnitCost}).`)
    }
  }

  await syncAverageCost(supabase, productId)

  return { unitCost: quantity > 0 ? totalCost / quantity : 0, totalCost }
}
