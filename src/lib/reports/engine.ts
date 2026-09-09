import 'server-only'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { orderDiscountFactors } from '@/lib/data/queries'
import {
  REPORT_ROW_LIMIT,
  type ReportColumn,
  type ReportGrouping,
  type ReportRequest,
  type ReportResult,
  type ReportSource,
} from '@/lib/reports/definitions'

/**
 * The query engine behind the custom report builder.
 *
 * Every source is tenant-scoped and, where the caller's data scope is `own`,
 * narrowed to the records they are responsible for — the same rule the list
 * pages apply (src/lib/data/paginate.ts). A report must never become the way
 * to read rows the module's own list hides.
 *
 * Cancelled documents are excluded from the money-bearing sources: they were
 * reversed out of stock and receivables, so counting them would report revenue
 * nobody earned (same reasoning as getCachedAnalyticsStats).
 */

interface EngineContext {
  tenantId: string
  /** Set when the caller may only see their own records; undefined = all. */
  ownerId?: string
}

const MONEY = 'money' as const
const NUMBER = 'number' as const
const TEXT = 'text' as const
const DATE = 'date' as const

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function periodKey(date: string | null | undefined, grouping: ReportGrouping): string {
  const iso = String(date ?? '').split('T')[0]
  if (!iso) return '—'
  return grouping === 'month' ? iso.slice(0, 7) : iso
}

/** Sums the numeric columns of the finished rows. */
function totalsFor(columns: ReportColumn[], rows: Record<string, any>[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const column of columns) {
    if (column.type !== 'money' && column.type !== 'number') continue
    totals[column.key] = rows.reduce((sum, row) => sum + toNumber(row[column.key]), 0)
  }
  return totals
}

function matchesSearch(search: string | undefined, ...values: (string | null | undefined)[]) {
  if (!search) return true
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return values.some((value) => String(value ?? '').toLowerCase().includes(needle))
}

/** Rolls raw rows up by a key, summing the numeric fields listed in `sums`. */
function groupRows(
  rows: Record<string, any>[],
  keyOf: (row: Record<string, any>) => string,
  labels: (row: Record<string, any>) => Record<string, string | number | null>,
  sums: string[],
  countKey?: string
): Record<string, any>[] {
  const grouped = new Map<string, Record<string, any>>()
  const counted = new Map<string, Set<string>>()
  for (const row of rows) {
    const key = keyOf(row)
    let target = grouped.get(key)
    if (!target) {
      target = { ...labels(row) }
      for (const field of sums) target[field] = 0
      if (countKey) target[countKey] = 0
      grouped.set(key, target)
      counted.set(key, new Set())
    }
    for (const field of sums) target[field] = toNumber(target[field]) + toNumber(row[field])
    if (countKey && row.__countOn) {
      const seen = counted.get(key)!
      if (!seen.has(row.__countOn)) {
        seen.add(row.__countOn)
        target[countKey] = toNumber(target[countKey]) + 1
      }
    }
  }
  return [...grouped.values()]
}

// ── sales ────────────────────────────────────────────────────────────────────

async function runSales(ctx: EngineContext, req: ReportRequest): Promise<ReportResult> {
  const supabase = getCacheClient() as any
  let query = supabase
    .from('sales_order_items')
    .select(
      'order_id, quantity, unit_price, unit_cost, total_price, ' +
        'products(name, sku, categories(name)), ' +
        'sales_orders!inner(order_number, order_date, status, discount_amount, assigned_to, customers(name))'
    )
    .eq('tenant_id', ctx.tenantId)
    .neq('sales_orders.status', 'cancelled')
  if (req.from) query = query.gte('sales_orders.order_date', req.from)
  if (req.to) query = query.lte('sales_orders.order_date', req.to)

  const { data, error } = await query.limit(REPORT_ROW_LIMIT + 1)
  if (error) throw new Error(error.message)

  const raw = (data ?? []).filter((row: any) => {
    if (ctx.ownerId) {
      const owner = row.sales_orders?.assigned_to
      if (owner && owner !== ctx.ownerId) return false
    }
    return matchesSearch(req.search, row.products?.name, row.products?.sku, row.sales_orders?.customers?.name)
  })

  // Same net-of-general-discount treatment the analytics page uses, so the two
  // never report different revenue for the same period.
  const factors = orderDiscountFactors(
    raw.map((row: any) => ({
      order_id: row.order_id,
      total_price: row.total_price,
      discount_amount: row.sales_orders?.discount_amount,
    }))
  )

  const rows = raw.map((row: any) => {
    const quantity = toNumber(row.quantity)
    const revenue = toNumber(row.total_price) * (factors.get(row.order_id) ?? 1)
    const cost = toNumber(row.unit_cost) * quantity
    return {
      __countOn: row.order_id as string,
      date: row.sales_orders?.order_date ?? null,
      period: periodKey(row.sales_orders?.order_date, req.groupBy),
      order_number: row.sales_orders?.order_number ?? null,
      customer: row.sales_orders?.customers?.name ?? '—',
      product: row.products?.name ?? '—',
      sku: row.products?.sku ?? null,
      category: row.products?.categories?.name ?? '—',
      quantity,
      unit_price: toNumber(row.unit_price),
      revenue,
      cost,
      profit: revenue - cost,
    }
  })

  const sums = ['quantity', 'revenue', 'cost', 'profit']

  switch (req.groupBy) {
    case 'day':
    case 'month': {
      const columns: ReportColumn[] = [
        { key: 'period', type: TEXT },
        { key: 'orders', type: NUMBER },
        { key: 'quantity', type: NUMBER },
        { key: 'revenue', type: MONEY },
        { key: 'cost', type: MONEY },
        { key: 'profit', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.period, (r) => ({ period: r.period }), sums, 'orders')
      grouped.sort((a, b) => String(a.period).localeCompare(String(b.period)))
      return finish(columns, grouped, rows.length)
    }
    case 'product': {
      const columns: ReportColumn[] = [
        { key: 'product', type: TEXT },
        { key: 'sku', type: TEXT },
        { key: 'quantity', type: NUMBER },
        { key: 'revenue', type: MONEY },
        { key: 'cost', type: MONEY },
        { key: 'profit', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.product, (r) => ({ product: r.product, sku: r.sku }), sums)
      grouped.sort((a, b) => toNumber(b.revenue) - toNumber(a.revenue))
      return finish(columns, grouped, rows.length)
    }
    case 'category': {
      const columns: ReportColumn[] = [
        { key: 'category', type: TEXT },
        { key: 'quantity', type: NUMBER },
        { key: 'revenue', type: MONEY },
        { key: 'cost', type: MONEY },
        { key: 'profit', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.category, (r) => ({ category: r.category }), sums)
      grouped.sort((a, b) => toNumber(b.revenue) - toNumber(a.revenue))
      return finish(columns, grouped, rows.length)
    }
    case 'customer': {
      const columns: ReportColumn[] = [
        { key: 'customer', type: TEXT },
        { key: 'orders', type: NUMBER },
        { key: 'quantity', type: NUMBER },
        { key: 'revenue', type: MONEY },
        { key: 'cost', type: MONEY },
        { key: 'profit', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.customer, (r) => ({ customer: r.customer }), sums, 'orders')
      grouped.sort((a, b) => toNumber(b.revenue) - toNumber(a.revenue))
      return finish(columns, grouped, rows.length)
    }
    default: {
      const columns: ReportColumn[] = [
        { key: 'date', type: DATE },
        { key: 'order_number', type: TEXT },
        { key: 'customer', type: TEXT },
        { key: 'product', type: TEXT },
        { key: 'quantity', type: NUMBER },
        { key: 'unit_price', type: MONEY },
        { key: 'revenue', type: MONEY },
        { key: 'profit', type: MONEY },
      ]
      const sorted = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
      return finish(columns, sorted, rows.length)
    }
  }
}

// ── purchases ────────────────────────────────────────────────────────────────

async function runPurchases(ctx: EngineContext, req: ReportRequest): Promise<ReportResult> {
  const supabase = getCacheClient() as any
  let query = supabase
    .from('purchase_order_items')
    .select(
      'po_id, quantity, unit_cost, total_cost, products(name, sku, categories(name)), ' +
        'purchase_orders!inner(po_number, order_date, status, assigned_to, suppliers(name))'
    )
    .eq('tenant_id', ctx.tenantId)
    .neq('purchase_orders.status', 'cancelled')
  if (req.from) query = query.gte('purchase_orders.order_date', req.from)
  if (req.to) query = query.lte('purchase_orders.order_date', req.to)

  const { data, error } = await query.limit(REPORT_ROW_LIMIT + 1)
  if (error) throw new Error(error.message)

  const rows = (data ?? [])
    .filter((row: any) => {
      if (ctx.ownerId) {
        const owner = row.purchase_orders?.assigned_to
        if (owner && owner !== ctx.ownerId) return false
      }
      return matchesSearch(req.search, row.products?.name, row.products?.sku, row.purchase_orders?.suppliers?.name)
    })
    .map((row: any) => ({
      __countOn: row.po_id as string,
      date: row.purchase_orders?.order_date ?? null,
      period: periodKey(row.purchase_orders?.order_date, req.groupBy),
      po_number: row.purchase_orders?.po_number ?? null,
      supplier: row.purchase_orders?.suppliers?.name ?? '—',
      product: row.products?.name ?? '—',
      sku: row.products?.sku ?? null,
      quantity: toNumber(row.quantity),
      unit_cost: toNumber(row.unit_cost),
      cost: toNumber(row.total_cost),
    }))

  const sums = ['quantity', 'cost']

  switch (req.groupBy) {
    case 'day':
    case 'month': {
      const columns: ReportColumn[] = [
        { key: 'period', type: TEXT },
        { key: 'purchases', type: NUMBER },
        { key: 'quantity', type: NUMBER },
        { key: 'cost', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.period, (r) => ({ period: r.period }), sums, 'purchases')
      grouped.sort((a, b) => String(a.period).localeCompare(String(b.period)))
      return finish(columns, grouped, rows.length)
    }
    case 'product': {
      const columns: ReportColumn[] = [
        { key: 'product', type: TEXT },
        { key: 'sku', type: TEXT },
        { key: 'quantity', type: NUMBER },
        { key: 'cost', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.product, (r) => ({ product: r.product, sku: r.sku }), sums)
      grouped.sort((a, b) => toNumber(b.cost) - toNumber(a.cost))
      return finish(columns, grouped, rows.length)
    }
    case 'supplier': {
      const columns: ReportColumn[] = [
        { key: 'supplier', type: TEXT },
        { key: 'purchases', type: NUMBER },
        { key: 'quantity', type: NUMBER },
        { key: 'cost', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.supplier, (r) => ({ supplier: r.supplier }), sums, 'purchases')
      grouped.sort((a, b) => toNumber(b.cost) - toNumber(a.cost))
      return finish(columns, grouped, rows.length)
    }
    default: {
      const columns: ReportColumn[] = [
        { key: 'date', type: DATE },
        { key: 'po_number', type: TEXT },
        { key: 'supplier', type: TEXT },
        { key: 'product', type: TEXT },
        { key: 'quantity', type: NUMBER },
        { key: 'unit_cost', type: MONEY },
        { key: 'cost', type: MONEY },
      ]
      const sorted = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
      return finish(columns, sorted, rows.length)
    }
  }
}

// ── finance ──────────────────────────────────────────────────────────────────

async function runFinance(ctx: EngineContext, req: ReportRequest): Promise<ReportResult> {
  const supabase = getCacheClient() as any
  let query = supabase
    .from('transactions')
    .select('type, amount, category, description, transaction_date, assigned_to')
    .eq('tenant_id', ctx.tenantId)
  if (req.from) query = query.gte('transaction_date', req.from)
  if (req.to) query = query.lte('transaction_date', req.to)
  if (ctx.ownerId) query = query.or(`assigned_to.eq.${ctx.ownerId},assigned_to.is.null`)

  const { data, error } = await query.limit(REPORT_ROW_LIMIT + 1)
  if (error) throw new Error(error.message)

  const rows = (data ?? [])
    .filter((row: any) => matchesSearch(req.search, row.category, row.description))
    .map((row: any) => {
      const amount = toNumber(row.amount)
      return {
        date: row.transaction_date ?? null,
        period: periodKey(row.transaction_date, req.groupBy),
        type: row.type as string,
        category: row.category ?? '—',
        description: row.description ?? '',
        income: row.type === 'income' ? amount : 0,
        expense: row.type === 'expense' ? amount : 0,
        net: row.type === 'income' ? amount : -amount,
      }
    })

  const sums = ['income', 'expense', 'net']

  switch (req.groupBy) {
    case 'day':
    case 'month': {
      const columns: ReportColumn[] = [
        { key: 'period', type: TEXT },
        { key: 'income', type: MONEY },
        { key: 'expense', type: MONEY },
        { key: 'net', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.period, (r) => ({ period: r.period }), sums)
      grouped.sort((a, b) => String(a.period).localeCompare(String(b.period)))
      return finish(columns, grouped, rows.length)
    }
    case 'category': {
      const columns: ReportColumn[] = [
        { key: 'category', type: TEXT },
        { key: 'income', type: MONEY },
        { key: 'expense', type: MONEY },
        { key: 'net', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.category, (r) => ({ category: r.category }), sums)
      grouped.sort((a, b) => Math.abs(toNumber(b.net)) - Math.abs(toNumber(a.net)))
      return finish(columns, grouped, rows.length)
    }
    case 'type': {
      const columns: ReportColumn[] = [
        { key: 'type', type: TEXT },
        { key: 'income', type: MONEY },
        { key: 'expense', type: MONEY },
        { key: 'net', type: MONEY },
      ]
      const grouped = groupRows(rows, (r) => r.type, (r) => ({ type: r.type }), sums)
      return finish(columns, grouped, rows.length)
    }
    default: {
      const columns: ReportColumn[] = [
        { key: 'date', type: DATE },
        { key: 'type', type: TEXT },
        { key: 'category', type: TEXT },
        { key: 'description', type: TEXT },
        { key: 'income', type: MONEY },
        { key: 'expense', type: MONEY },
      ]
      const sorted = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
      return finish(columns, sorted, rows.length)
    }
  }
}

// ── inventory (snapshot) ─────────────────────────────────────────────────────

async function runInventory(ctx: EngineContext, req: ReportRequest): Promise<ReportResult> {
  const supabase = getCacheClient() as any
  let query = supabase
    .from('products')
    .select('name, sku, stock, min_stock, cost_price, price, is_active, assigned_to, categories(name)')
    .eq('tenant_id', ctx.tenantId)
  if (ctx.ownerId) query = query.or(`assigned_to.eq.${ctx.ownerId},assigned_to.is.null`)

  const { data, error } = await query.limit(REPORT_ROW_LIMIT + 1)
  if (error) throw new Error(error.message)

  const rows = (data ?? [])
    .filter((row: any) => matchesSearch(req.search, row.name, row.sku, row.categories?.name))
    .map((row: any) => {
      const stock = toNumber(row.stock)
      const costPrice = toNumber(row.cost_price)
      return {
        product: row.name ?? '—',
        sku: row.sku ?? null,
        category: row.categories?.name ?? '—',
        stock,
        min_stock: toNumber(row.min_stock),
        cost_price: costPrice,
        price: toNumber(row.price),
        value: stock * costPrice,
      }
    })

  if (req.groupBy === 'category') {
    const columns: ReportColumn[] = [
      { key: 'category', type: TEXT },
      { key: 'items', type: NUMBER },
      { key: 'stock', type: NUMBER },
      { key: 'value', type: MONEY },
    ]
    const grouped = new Map<string, Record<string, any>>()
    for (const row of rows) {
      const target = grouped.get(row.category) ?? { category: row.category, items: 0, stock: 0, value: 0 }
      target.items += 1
      target.stock += row.stock
      target.value += row.value
      grouped.set(row.category, target)
    }
    const list = [...grouped.values()].sort((a, b) => toNumber(b.value) - toNumber(a.value))
    return finish(columns, list, rows.length)
  }

  const columns: ReportColumn[] = [
    { key: 'product', type: TEXT },
    { key: 'sku', type: TEXT },
    { key: 'category', type: TEXT },
    { key: 'stock', type: NUMBER },
    { key: 'min_stock', type: NUMBER },
    { key: 'cost_price', type: MONEY },
    { key: 'price', type: MONEY },
    { key: 'value', type: MONEY },
  ]
  const sorted = rows.slice().sort((a, b) => toNumber(b.value) - toNumber(a.value))
  return finish(columns, sorted, rows.length)
}

// ── stock movements ──────────────────────────────────────────────────────────

async function runMovements(ctx: EngineContext, req: ReportRequest): Promise<ReportResult> {
  const supabase = getCacheClient() as any
  let query = supabase
    .from('stock_movements')
    .select('type, quantity, quantity_before, quantity_after, reason, created_at, products(name, sku)')
    .eq('tenant_id', ctx.tenantId)
  if (req.from) query = query.gte('created_at', `${req.from}T00:00:00`)
  if (req.to) query = query.lte('created_at', `${req.to}T23:59:59`)

  const { data, error } = await query.limit(REPORT_ROW_LIMIT + 1)
  if (error) throw new Error(error.message)

  const rows = (data ?? [])
    .filter((row: any) => matchesSearch(req.search, row.products?.name, row.products?.sku, row.reason))
    .map((row: any) => {
      const quantity = toNumber(row.quantity)
      return {
        date: row.created_at ?? null,
        period: periodKey(row.created_at, req.groupBy),
        product: row.products?.name ?? '—',
        sku: row.products?.sku ?? null,
        type: row.type as string,
        quantity,
        before: toNumber(row.quantity_before),
        after: toNumber(row.quantity_after),
        stock_in: row.type === 'in' ? quantity : 0,
        stock_out: row.type === 'out' ? quantity : 0,
        reason: row.reason ?? '',
      }
    })

  const sums = ['stock_in', 'stock_out']

  switch (req.groupBy) {
    case 'day': {
      const columns: ReportColumn[] = [
        { key: 'period', type: TEXT },
        { key: 'stock_in', type: NUMBER },
        { key: 'stock_out', type: NUMBER },
      ]
      const grouped = groupRows(rows, (r) => r.period, (r) => ({ period: r.period }), sums)
      grouped.sort((a, b) => String(a.period).localeCompare(String(b.period)))
      return finish(columns, grouped, rows.length)
    }
    case 'product': {
      const columns: ReportColumn[] = [
        { key: 'product', type: TEXT },
        { key: 'sku', type: TEXT },
        { key: 'stock_in', type: NUMBER },
        { key: 'stock_out', type: NUMBER },
      ]
      const grouped = groupRows(rows, (r) => r.product, (r) => ({ product: r.product, sku: r.sku }), sums)
      grouped.sort((a, b) => toNumber(b.stock_out) - toNumber(a.stock_out))
      return finish(columns, grouped, rows.length)
    }
    case 'type': {
      const columns: ReportColumn[] = [
        { key: 'type', type: TEXT },
        { key: 'quantity', type: NUMBER },
      ]
      const grouped = groupRows(rows, (r) => r.type, (r) => ({ type: r.type }), ['quantity'])
      return finish(columns, grouped, rows.length)
    }
    default: {
      const columns: ReportColumn[] = [
        { key: 'date', type: DATE },
        { key: 'product', type: TEXT },
        { key: 'type', type: TEXT },
        { key: 'quantity', type: NUMBER },
        { key: 'before', type: NUMBER },
        { key: 'after', type: NUMBER },
        { key: 'reason', type: TEXT },
      ]
      const sorted = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
      return finish(columns, sorted, rows.length)
    }
  }
}

function finish(
  columns: ReportColumn[],
  rows: Record<string, any>[],
  rawCount: number
): ReportResult {
  const trimmed = rows.slice(0, REPORT_ROW_LIMIT).map((row) => {
    const clean: Record<string, string | number | null> = {}
    for (const column of columns) clean[column.key] = row[column.key] ?? (column.type === 'text' ? '' : 0)
    return clean
  })
  return {
    columns,
    rows: trimmed,
    totals: totalsFor(columns, trimmed),
    truncated: rawCount > REPORT_ROW_LIMIT,
  }
}

const RUNNERS: Record<ReportSource, (ctx: EngineContext, req: ReportRequest) => Promise<ReportResult>> = {
  sales: runSales,
  purchases: runPurchases,
  finance: runFinance,
  inventory: runInventory,
  movements: runMovements,
}

export function runReport(ctx: EngineContext, req: ReportRequest): Promise<ReportResult> {
  return RUNNERS[req.source](ctx, req)
}
