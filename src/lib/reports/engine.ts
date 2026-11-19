import 'server-only'
import type { ReportRequest, ReportResult, ReportSource } from '@/lib/reports/definitions'
import type { EngineContext, Runner } from '@/lib/reports/engine-core'
import { runFinance } from '@/lib/reports/sources/finance'
import { runPurchases } from '@/lib/reports/sources/purchases'
import { runSales } from '@/lib/reports/sources/sales'
import { runInventory, runMovements } from '@/lib/reports/sources/stock'

/**
 * The query engine behind the custom report builder. Every source is tenant-scoped and,
 * with an `own` data scope, narrowed to the caller's records — the same rule the list
 * pages apply — so a report never reads rows the module's own list hides.
 */
const RUNNERS: Record<ReportSource, Runner> = {
  sales: runSales,
  purchases: runPurchases,
  finance: runFinance,
  inventory: runInventory,
  movements: runMovements,
}

export function runReport(ctx: EngineContext, req: ReportRequest): Promise<ReportResult> {
  return RUNNERS[req.source](ctx, req)
}
