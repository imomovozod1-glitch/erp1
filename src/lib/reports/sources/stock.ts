import 'server-only'
import { fetchRows, reportClient, matchesSearch, periodKey, present, toNumber, type ReportView, type Runner } from '@/lib/reports/engine-core'

const INVENTORY_VIEWS: Record<string, ReportView> = {
  category: { columns: { category: 'text', items: 'number', stock: 'number', value: 'money' }, by: ['category'], count: 'items', order: { desc: 'value' } },
  none: {
    columns: { product: 'text', sku: 'text', category: 'text', stock: 'number', min_stock: 'number', cost_price: 'money', price: 'money', value: 'money' },
    order: { desc: 'value' },
  },
}

/** A snapshot of goods only: a service holds no stock and would inflate every category's count. */
export const runInventory: Runner = async (ctx, req) => {
  let query = reportClient()
    .from('products')
    .select('name, sku, stock, min_stock, cost_price, price, is_active, assigned_to, categories(name)')
    .eq('tenant_id', ctx.tenantId)
    .eq('is_service', false)
  if (ctx.ownerId) query = query.or(`assigned_to.eq.${ctx.ownerId},assigned_to.is.null`)
  const rows = (await fetchRows(query))
    .filter((row) => matchesSearch(req.search, row.name, row.sku, row.categories?.name))
    .map((row, index) => {
      const stock = toNumber(row.stock)
      const costPrice = toNumber(row.cost_price)
      return {
        __countOn: String(index),
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
  return present(rows, INVENTORY_VIEWS, req.groupBy, ['stock', 'value'])
}

const MOVEMENT_VIEWS: Record<string, ReportView> = {
  day: { columns: { period: 'text', stock_in: 'number', stock_out: 'number' }, by: ['period'], order: { asc: 'period' } },
  product: { columns: { product: 'text', sku: 'text', stock_in: 'number', stock_out: 'number' }, by: ['product', 'sku'], order: { desc: 'stock_out' } },
  type: { columns: { type: 'text', quantity: 'number' }, by: ['type'], sums: ['quantity'] },
  none: {
    columns: { date: 'date', product: 'text', type: 'text', quantity: 'number', before: 'number', after: 'number', reason: 'text' },
    order: { desc: 'date' },
  },
}

export const runMovements: Runner = async (ctx, req) => {
  let query = reportClient()
    .from('stock_movements')
    .select('type, quantity, quantity_before, quantity_after, reason, created_at, products(name, sku)')
    .eq('tenant_id', ctx.tenantId)
  if (req.from) query = query.gte('created_at', `${req.from}T00:00:00`)
  if (req.to) query = query.lte('created_at', `${req.to}T23:59:59`)
  const rows = (await fetchRows(query))
    .filter((row) => matchesSearch(req.search, row.products?.name, row.products?.sku, row.reason))
    .map((row) => {
      const quantity = toNumber(row.quantity)
      return {
        date: row.created_at ?? null,
        period: periodKey(row.created_at, req.groupBy),
        product: row.products?.name ?? '—',
        sku: row.products?.sku ?? null,
        type: row.type,
        quantity,
        before: toNumber(row.quantity_before),
        after: toNumber(row.quantity_after),
        stock_in: row.type === 'in' ? quantity : 0,
        stock_out: row.type === 'out' ? quantity : 0,
        reason: row.reason ?? '',
      }
    })
  return present(rows, MOVEMENT_VIEWS, req.groupBy, ['stock_in', 'stock_out'])
}
