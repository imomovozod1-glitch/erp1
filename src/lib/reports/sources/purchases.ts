import 'server-only'
import { fetchRows, reportClient, matchesSearch, ownedBy, periodKey, present, toNumber, type ReportView, type Runner } from '@/lib/reports/engine-core'

const SELECT =
  'po_id, quantity, unit_cost, total_cost, products(name, sku, categories(name)), ' +
  'purchase_orders!inner(po_number, order_date, status, assigned_to, suppliers(name))'

const BY_PERIOD: ReportView = {
  columns: { period: 'text', purchases: 'number', quantity: 'number', cost: 'money' },
  by: ['period'],
  count: 'purchases',
  order: { asc: 'period' },
}

const VIEWS: Record<string, ReportView> = {
  day: BY_PERIOD,
  month: BY_PERIOD,
  product: { columns: { product: 'text', sku: 'text', quantity: 'number', cost: 'money' }, by: ['product', 'sku'], order: { desc: 'cost' } },
  supplier: { columns: { supplier: 'text', purchases: 'number', quantity: 'number', cost: 'money' }, by: ['supplier'], count: 'purchases', order: { desc: 'cost' } },
  none: {
    columns: { date: 'date', po_number: 'text', supplier: 'text', product: 'text', quantity: 'number', unit_cost: 'money', cost: 'money' },
    order: { desc: 'date' },
  },
}

export const runPurchases: Runner = async (ctx, req) => {
  let query = reportClient().from('purchase_order_items').select(SELECT).eq('tenant_id', ctx.tenantId).neq('purchase_orders.status', 'cancelled')
  if (req.from) query = query.gte('purchase_orders.order_date', req.from)
  if (req.to) query = query.lte('purchase_orders.order_date', req.to)
  const rows = (await fetchRows(query))
    .filter((row) => ownedBy(ctx.ownerId, row.purchase_orders?.assigned_to) && matchesSearch(req.search, row.products?.name, row.products?.sku, row.purchase_orders?.suppliers?.name))
    .map((row) => ({
      __countOn: row.po_id,
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
  return present(rows, VIEWS, req.groupBy, ['quantity', 'cost'])
}
