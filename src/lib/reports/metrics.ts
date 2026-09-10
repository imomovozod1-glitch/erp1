/**
 * The catalogue of KPI figures the overview can show.
 *
 * Every entry is derived from data the page has already loaded and already
 * narrowed to the selected period — nothing here triggers another query, and
 * nothing is invented. That constraint is what keeps the list honest: a metric
 * only appears if it can actually be computed from the sales, cost and stock
 * figures on hand.
 *
 * Unlike the block picker (src/lib/reports/widgets.ts) this stores the
 * *selected* ids, in order. A KPI row is a curated shortlist, not a default
 * set with exceptions — so the user's pick, and the order they picked in, is
 * exactly what gets rendered.
 */

export const OVERVIEW_METRICS = [
  'revenue',
  'profit',
  'cost',
  'margin',
  'orders',
  'avgOrder',
  'soldQty',
  'avgUnitPrice',
  'avgItemsPerOrder',
  'productTypes',
  'topProductRevenue',
  'lowStockCount',
] as const

export type MetricId = (typeof OVERVIEW_METRICS)[number]

/** What today's fixed four tiles showed, so nothing changes until the user chooses. */
export const DEFAULT_METRICS: MetricId[] = ['revenue', 'orders', 'profit', 'soldQty']

export type MetricFormat = 'money' | 'number' | 'percent'

export const METRIC_FORMAT: Record<MetricId, MetricFormat> = {
  revenue: 'money',
  profit: 'money',
  cost: 'money',
  margin: 'percent',
  orders: 'number',
  avgOrder: 'money',
  soldQty: 'number',
  avgUnitPrice: 'money',
  avgItemsPerOrder: 'number',
  productTypes: 'number',
  topProductRevenue: 'money',
  lowStockCount: 'number',
}

/**
 * Metrics that describe the warehouse right now rather than the chosen period.
 * The UI marks these, because a "last 7 days" filter above a stock count the
 * period never touched is otherwise quietly misleading.
 */
export const SNAPSHOT_METRICS: MetricId[] = ['lowStockCount']

/** Everything the catalogue needs, already period-filtered by the caller. */
export interface MetricInput {
  totalRevenue: number
  totalProfit: number
  totalSold: number
  totalOrders: number
  /** Distinct products that actually sold in the period. */
  productTypes: number
  /** Revenue of the single best-selling product in the period. */
  topProductRevenue: number
  /** Products currently below their minimum — a snapshot, not period-scoped. */
  lowStockCount: number
}

export function computeMetric(id: MetricId, input: MetricInput): number {
  switch (id) {
    case 'revenue': return input.totalRevenue
    case 'profit': return input.totalProfit
    // Cost is revenue minus profit by construction, so it can never disagree
    // with the two tiles beside it.
    case 'cost': return input.totalRevenue - input.totalProfit
    case 'margin':
      return input.totalRevenue > 0 ? (input.totalProfit / input.totalRevenue) * 100 : 0
    case 'orders': return input.totalOrders
    case 'avgOrder':
      return input.totalOrders > 0 ? input.totalRevenue / input.totalOrders : 0
    case 'soldQty': return input.totalSold
    case 'avgUnitPrice':
      return input.totalSold > 0 ? input.totalRevenue / input.totalSold : 0
    case 'avgItemsPerOrder':
      return input.totalOrders > 0 ? input.totalSold / input.totalOrders : 0
    case 'productTypes': return input.productTypes
    case 'topProductRevenue': return input.topProductRevenue
    case 'lowStockCount': return input.lowStockCount
  }
}

const STORAGE_KEY = 'erp_overview_metrics'

export function readVisibleMetrics(): MetricId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_METRICS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_METRICS
    // Drop ids from an older release rather than rendering a blank tile.
    const valid = parsed.filter((id): id is MetricId =>
      (OVERVIEW_METRICS as readonly string[]).includes(id)
    )
    // An empty saved list is a stored state, not a corrupt one — but an empty
    // KPI row reads as a broken page, so fall back.
    return valid.length > 0 ? valid : DEFAULT_METRICS
  } catch {
    return DEFAULT_METRICS
  }
}

export function persistVisibleMetrics(metrics: MetricId[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics))
  } catch {
    /* private mode / quota — the choice just isn't remembered next visit */
  }
}
