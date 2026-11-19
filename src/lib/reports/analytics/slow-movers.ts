import { isoDay } from './dates'
import type { CatalogProductRow, SalesItemRow } from './types'

export interface SlowMoverRow {
  id: string
  name: string
  sku: string
  stock: number
  price: number
  quantity: number
  revenue: number
  /** Money sitting in this product's unsold stock, at cost. */
  tiedUpValue: number
  /** Days since the last sale, or null if it has never sold. */
  daysSinceLastSale: number | null
}

/**
 * Products that barely sold, or didn't sell at all, in the period — ranked by
 * how much money is tied up in their stock.
 *
 * Ordering by tied-up value rather than by units sold is what makes the list
 * actionable: fifty unsold keyrings and four unsold refrigerators are both
 * "zero sales", and only one of them is a problem worth a decision.
 */
export function slowMovers(
  products: CatalogProductRow[],
  periodItems: SalesItemRow[],
  allItems: SalesItemRow[],
  today: Date,
  options: { maxQuantity?: number; includeOutOfStock?: boolean } = {}
): SlowMoverRow[] {
  const { maxQuantity = 0, includeOutOfStock = false } = options

  const soldInPeriod = new Map<string, { quantity: number; revenue: number }>()
  for (const item of periodItems) {
    if (!item.product_id) continue
    const entry = soldInPeriod.get(item.product_id) ?? { quantity: 0, revenue: 0 }
    entry.quantity += item.quantity
    entry.revenue += item.revenue
    soldInPeriod.set(item.product_id, entry)
  }

  // Last sale is deliberately taken from the FULL history, not the period: the
  // useful fact about a product with no sales this month is when it last sold
  // at all, which a period-scoped scan can only ever answer with "never".
  const lastSale = new Map<string, string>()
  for (const item of allItems) {
    if (!item.product_id || !item.order_date) continue
    const day = item.order_date.slice(0, 10)
    const seen = lastSale.get(item.product_id)
    if (!seen || day > seen) lastSale.set(item.product_id, day)
  }

  const todayMs = new Date(`${isoDay(today)}T12:00`).getTime()

  return products
    .filter((p) => p.is_active)
    // A slow mover is capital sitting on a shelf. A service has no shelf, so it
    // is never one — it was only hidden here by having stock 0, and reappeared
    // the moment "include out of stock" was ticked.
    .filter((p) => !p.is_service)
    .filter((p) => includeOutOfStock || p.stock > 0)
    .map((p) => {
      const sold = soldInPeriod.get(p.id) ?? { quantity: 0, revenue: 0 }
      const last = lastSale.get(p.id)
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        price: p.price,
        quantity: sold.quantity,
        revenue: sold.revenue,
        tiedUpValue: p.stock * p.cost_price,
        daysSinceLastSale: last
          ? Math.max(0, Math.round((todayMs - new Date(`${last}T12:00`).getTime()) / 86_400_000))
          : null,
      }
    })
    .filter((row) => row.quantity <= maxQuantity)
    .sort((a, b) => b.tiedUpValue - a.tiedUpValue)
}
