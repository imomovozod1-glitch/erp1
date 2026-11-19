import { isoDay } from './dates'
import type { DateRange, SalesItemRow, SalesOrderRow } from './types'

export interface SalesTotals {
  revenue: number
  cost: number
  profit: number
  margin: number
  orders: number
  soldQty: number
  /** Money per receipt. */
  avgCheck: number
  /** Units per receipt — "chekdagi o'rtacha miqdor". */
  avgItemsPerCheck: number
  /** Distinct products that actually sold. */
  productTypes: number
}

export function computeTotals(orders: SalesOrderRow[], items: SalesItemRow[]): SalesTotals {
  const revenue = items.reduce((sum, i) => sum + i.revenue, 0)
  const cost = items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)
  const soldQty = items.reduce((sum, i) => sum + i.quantity, 0)
  const orderCount = orders.length
  const profit = revenue - cost
  return {
    revenue,
    cost,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    orders: orderCount,
    soldQty,
    avgCheck: orderCount > 0 ? revenue / orderCount : 0,
    avgItemsPerCheck: orderCount > 0 ? soldQty / orderCount : 0,
    productTypes: new Set(items.map((i) => i.product_id ?? i.product_name)).size,
  }
}

// ─── Daily series ─────────────────────────────────────────────────────────────

export interface DayPoint {
  /** `YYYY-MM-DD`. */
  day: string
  revenue: number
  orders: number
}

/**
 * Revenue and receipt count per calendar day across the selected range.
 *
 * Every day in the range gets a point, including the ones with no sales —
 * a chart that simply omits quiet days draws a flat line between two peaks
 * and reads as "steady trade" when the truth is "closed on Sunday". The
 * series therefore spans exactly what the period filter selected: one point
 * for "today", seven for "last 7 days", the whole calendar month for
 * "this month". When the range is open-ended ("all time") it spans the first
 * to the last sale instead, and a range wider than `maxDays` falls back to the
 * days that actually have sales so the axis stays legible.
 *
 * Revenue is summed from the ORDER LINES, not from `orders.total_amount`:
 * every other figure on these screens — the revenue KPI, the product and
 * seller tables — is the sum of line revenue net of the order's general
 * discount, and a chart drawn from a different column silently disagrees with
 * the number printed directly above it. `orders` still counts receipts, so a
 * day with a sale but no lines is drawn as a real (zero-revenue) day rather
 * than vanishing.
 */
export function dailySeries(
  orders: SalesOrderRow[],
  items: SalesItemRow[],
  range: DateRange,
  maxDays = 180
): DayPoint[] {
  const buckets = new Map<string, DayPoint>()
  const bucketFor = (day: string) => {
    let entry = buckets.get(day)
    if (!entry) {
      entry = { day, revenue: 0, orders: 0 }
      buckets.set(day, entry)
    }
    return entry
  }

  for (const order of orders) {
    if (!order.order_date) continue
    bucketFor(order.order_date.slice(0, 10)).orders += 1
  }
  for (const item of items) {
    if (!item.order_date) continue
    bucketFor(item.order_date.slice(0, 10)).revenue += item.revenue
  }

  const sold = [...buckets.keys()].sort()
  const first = range.start ? isoDay(range.start) : sold[0]
  const last = range.end ? isoDay(range.end) : sold[sold.length - 1]
  if (!first || !last || first > last) {
    return sold.map((day) => buckets.get(day)!)
  }

  const span = Math.round(
    (new Date(`${last}T12:00`).getTime() - new Date(`${first}T12:00`).getTime()) / 86_400_000
  ) + 1
  if (span > maxDays) {
    return sold.map((day) => buckets.get(day)!)
  }

  const out: DayPoint[] = []
  const cursor = new Date(`${first}T12:00`)
  for (let i = 0; i < span; i++) {
    const day = isoDay(cursor)
    out.push(buckets.get(day) ?? { day, revenue: 0, orders: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

export interface GroupRow {
  key: string
  label: string
  revenue: number
  cost: number
  profit: number
  quantity: number
  /** Distinct receipts this group appears on. */
  orders: number
  /** Revenue ÷ receipts. */
  avgCheck: number
  share: number
}

/**
 * Sums the sale lines into one row per group, ranked by revenue.
 *
 * `orders` counts DISTINCT order ids rather than lines: a receipt with four
 * products is one sale to the customer, not four, and counting lines inflated
 * every average-check figure by the basket size.
 */
export function groupItems(
  items: SalesItemRow[],
  keyOf: (item: SalesItemRow) => string,
  labelOf: (item: SalesItemRow) => string
): GroupRow[] {
  const acc = new Map<string, GroupRow & { orderIds: Set<string> }>()
  for (const item of items) {
    const key = keyOf(item)
    let row = acc.get(key)
    if (!row) {
      row = {
        key,
        label: labelOf(item),
        revenue: 0,
        cost: 0,
        profit: 0,
        quantity: 0,
        orders: 0,
        avgCheck: 0,
        share: 0,
        orderIds: new Set<string>(),
      }
      acc.set(key, row)
    }
    row.revenue += item.revenue
    row.cost += item.unit_cost * item.quantity
    row.quantity += item.quantity
    row.orderIds.add(item.order_id)
  }

  const rows = [...acc.values()].map(({ orderIds, ...row }) => ({
    ...row,
    profit: row.revenue - row.cost,
    orders: orderIds.size,
    avgCheck: orderIds.size > 0 ? row.revenue / orderIds.size : 0,
  }))

  const total = rows.reduce((sum, r) => sum + r.revenue, 0)
  for (const row of rows) row.share = total > 0 ? (row.revenue / total) * 100 : 0
  return rows.sort((a, b) => b.revenue - a.revenue)
}
