import 'server-only'
import { orderDiscountFactors } from '@/lib/sales-discounts'
import { fetchRows, reportClient, matchesSearch, ownedBy, periodKey, present, toNumber, type ReportView, type Runner } from '@/lib/reports/engine-core'

const SELECT =
  'order_id, quantity, unit_price, unit_cost, total_price, products(name, sku, categories(name)), ' +
  'sales_orders!inner(order_number, order_date, status, discount_amount, assigned_to, customers(name))'

const BY_PERIOD: ReportView = {
  columns: { period: 'text', orders: 'number', quantity: 'number', revenue: 'money', cost: 'money', profit: 'money' },
  by: ['period'],
  count: 'orders',
  order: { asc: 'period' },
}

const VIEWS: Record<string, ReportView> = {
  day: BY_PERIOD,
  month: BY_PERIOD,
  product: {
    columns: { product: 'text', sku: 'text', quantity: 'number', revenue: 'money', cost: 'money', profit: 'money' },
    by: ['product', 'sku'],
    order: { desc: 'revenue' },
  },
  category: {
    columns: { category: 'text', quantity: 'number', revenue: 'money', cost: 'money', profit: 'money' },
    by: ['category'],
    order: { desc: 'revenue' },
  },
  customer: {
    columns: { customer: 'text', orders: 'number', quantity: 'number', revenue: 'money', cost: 'money', profit: 'money' },
    by: ['customer'],
    count: 'orders',
    order: { desc: 'revenue' },
  },
  none: {
    columns: { date: 'date', order_number: 'text', customer: 'text', product: 'text', quantity: 'number', unit_price: 'money', revenue: 'money', profit: 'money' },
    order: { desc: 'date' },
  },
}

/** Cancelled sales were reversed out of stock and receivables, so they are not revenue. */
export const runSales: Runner = async (ctx, req) => {
  let query = reportClient().from('sales_order_items').select(SELECT).eq('tenant_id', ctx.tenantId).neq('sales_orders.status', 'cancelled')
  if (req.from) query = query.gte('sales_orders.order_date', req.from)
  if (req.to) query = query.lte('sales_orders.order_date', req.to)
  const raw = (await fetchRows(query)).filter(
    (row) => ownedBy(ctx.ownerId, row.sales_orders?.assigned_to) && matchesSearch(req.search, row.products?.name, row.products?.sku, row.sales_orders?.customers?.name)
  )
  // Net of the order-level discount, the same way the analytics page counts revenue.
  const factors = orderDiscountFactors(raw.map((row) => ({ order_id: row.order_id, total_price: row.total_price, discount_amount: row.sales_orders?.discount_amount })))
  const rows = raw.map((row) => {
    const quantity = toNumber(row.quantity)
    const revenue = toNumber(row.total_price) * (factors.get(row.order_id) ?? 1)
    const cost = toNumber(row.unit_cost) * quantity
    const order = row.sales_orders
    return {
      __countOn: row.order_id,
      date: order?.order_date ?? null,
      period: periodKey(order?.order_date, req.groupBy),
      order_number: order?.order_number ?? null,
      customer: order?.customers?.name ?? '—',
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
  return present(rows, VIEWS, req.groupBy, ['quantity', 'revenue', 'cost', 'profit'])
}
