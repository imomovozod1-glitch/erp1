/**
 * Pure aggregation helpers shared by the five sales reports.
 *
 * The reports differ only in what they group by — day, seller, customer,
 * product, revenue share — so the filtering, bucketing and ranking live here
 * once and each report page is left holding nothing but its own table markup.
 * Nothing in this file touches React, the network or the clock beyond the
 * range it is handed, which is what makes the numbers on five screens
 * provably the same numbers.
 */

export interface SalesOrderRow {
  id: string
  order_number: string
  order_date: string | null
  total_amount: number
  customer_id: string | null
  customer_name: string
  seller_id: string | null
  seller_name: string
}

export interface SalesItemRow {
  order_id: string
  product_id: string | null
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  unit_cost: number
  /** Already net of the order's general discount. */
  revenue: number
  order_date: string | null
  customer_id: string | null
  seller_id: string | null
}

export interface CatalogProductRow {
  id: string
  name: string
  sku: string
  stock: number
  price: number
  cost_price: number
  is_active: boolean
}

export interface DateRange {
  start: Date | null
  end: Date | null
}

/** `YYYY-MM-DD` for a Date, in local time — never `toISOString()`, which shifts the day across the UTC boundary. */
export function isoDay(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Parses the `YYYY-MM-DDTHH:mm` strings the period filter produces. */
export function parseBound(value: string, endOfDay: boolean): Date | null {
  if (!value) return null
  const withTime = value.includes('T') ? value : `${value}T${endOfDay ? '23:59' : '00:00'}`
  const d = new Date(withTime)
  return Number.isNaN(d.getTime()) ? null : d
}

/** True when `dateish` (a date column, with or without a time part) lies inside the range. */
export function inRange(dateish: string | null | undefined, range: DateRange): boolean {
  if (!range.start && !range.end) return true
  if (!dateish) return false
  const d = new Date(dateish.includes('T') ? dateish : `${dateish}T12:00`)
  if (Number.isNaN(d.getTime())) return false
  if (range.start && d < range.start) return false
  if (range.end && d > range.end) return false
  return true
}

/**
 * The range a preset stands for, relative to an explicitly supplied "today".
 *
 * `presetRange()` in period-filter.tsx does the same job but reads the system
 * clock itself, which makes it an impure call — illegal during render under
 * the React Compiler lint rules this project enforces (see AGENTS.md). Report
 * pages therefore take today's date as a prop from the server and resolve
 * their ranges through this instead.
 *
 * Returns null for presets with no bounds ("all"), which callers read as
 * "don't filter".
 */
export function presetRangeFrom(preset: string, today: Date): DateRange | null {
  const dayStart = (d: Date) => {
    const copy = new Date(d)
    copy.setHours(0, 0, 0, 0)
    return copy
  }
  const dayEnd = (d: Date) => {
    const copy = new Date(d)
    copy.setHours(23, 59, 59, 999)
    return copy
  }
  const shiftDays = (d: Date, days: number) => {
    const copy = new Date(d)
    copy.setDate(copy.getDate() + days)
    return copy
  }

  switch (preset) {
    case 'today':
      return { start: dayStart(today), end: dayEnd(today) }
    case 'yesterday': {
      const yesterday = shiftDays(today, -1)
      return { start: dayStart(yesterday), end: dayEnd(yesterday) }
    }
    // Rolling windows, matching the "last 7 / 30 days" labels.
    case 'week':
      return { start: dayStart(shiftDays(today, -6)), end: dayEnd(today) }
    case 'month':
      return { start: dayStart(shiftDays(today, -29)), end: dayEnd(today) }
    case 'thisMonth': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: dayStart(first), end: dayEnd(today) }
    }
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: dayStart(first), end: dayEnd(last) }
    }
    default:
      return null
  }
}

// ─── Totals ───────────────────────────────────────────────────────────────────

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

// ─── ABC ──────────────────────────────────────────────────────────────────────

export type AbcClass = 'A' | 'B' | 'C'

/**
 * What the ranking is done BY.
 *
 * Revenue answers "what brings the money in", profit answers "what actually
 * earns", quantity answers "what moves off the shelf" — and the three lists
 * genuinely differ: a cheap fast-moving item is an A by units and a C by
 * profit. The step the classic method calls "choose the indicator" is this.
 */
export type AbcMetric = 'revenue' | 'profit' | 'quantity'

export const ABC_METRICS: AbcMetric[] = ['revenue', 'profit', 'quantity']

export function abcMetricValue(row: GroupRow, metric: AbcMetric): number {
  if (metric === 'profit') return row.profit
  if (metric === 'quantity') return row.quantity
  return row.revenue
}

export interface AbcRow extends GroupRow {
  /** The value the ranking was done by — revenue, profit or units sold. */
  metricValue: number
  /** This row's share of the metric total, in percent. */
  metricShare: number
  /** Running share of the metric total, including this row. */
  cumulativeShare: number
  abc: AbcClass
}

/** Cut-offs on the cumulative curve. The classic 80/95 Pareto split. */
export const ABC_THRESHOLDS = { a: 80, b: 95 } as const

/**
 * The four steps of an ABC analysis, in order: take the chosen indicator,
 * rank the rows by it from highest to lowest, work out each row's share and
 * the running (cumulative) share, then cut the list at 80% and 95% — the rows
 * making the first 80% are A, up to 95% are B, the tail is C.
 *
 * The class is decided by the cumulative share *before* the row, so the item
 * that carries the total past 80% is still an A — it is part of what earns
 * that 80%, and excluding it is the classic off-by-one that drops a shop's
 * second-best seller into the B pile.
 *
 * Only positive values count toward the total. Under the `profit` metric a
 * loss-making product has a negative value, and letting that shrink the
 * denominator would push everyone else's share above 100%; such rows rank last
 * and land in C, which is exactly where a product that loses money belongs.
 */
export function classifyAbc(rows: GroupRow[], metric: AbcMetric = 'revenue'): AbcRow[] {
  const ranked = [...rows].sort(
    (a, b) => abcMetricValue(b, metric) - abcMetricValue(a, metric)
  )
  const total = ranked.reduce((sum, r) => sum + Math.max(0, abcMetricValue(r, metric)), 0)

  let running = 0
  return ranked.map((row) => {
    const metricValue = abcMetricValue(row, metric)
    const previousShare = total > 0 ? (running / total) * 100 : 0
    running += Math.max(0, metricValue)
    const abc: AbcClass =
      metricValue <= 0
        ? 'C'
        : previousShare < ABC_THRESHOLDS.a
          ? 'A'
          : previousShare < ABC_THRESHOLDS.b
            ? 'B'
            : 'C'
    return {
      ...row,
      metricValue,
      metricShare: total > 0 ? (metricValue / total) * 100 : 0,
      cumulativeShare: total > 0 ? (running / total) * 100 : 0,
      abc,
    }
  })
}

// ─── Slow movers ──────────────────────────────────────────────────────────────

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
