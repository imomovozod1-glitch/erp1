import { downloadWorkbook } from '@/components/shared/detail-page'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils'
import { translateMovementReason } from '@/lib/movement-reason'
import { isIncoming, type ProductHistory } from './product-detail-types'

type Translate = (key: string) => string

const dateOf = (value?: string) => (value ? formatDateTime(value) : '—')

function infoSheet(product: any, t: Translate) {
  const status = t(product.is_active ? 'common.active' : 'common.inactive')
  const value = t('inventory.value')
  const rows: [string, unknown, string][] = [
    [t('common.name'), product.name, product.name],
    [t('inventory.sku'), product.sku, product.sku],
    [t('inventory.category'), product.categories?.name ?? '—', product.categories?.name ?? '—'],
    [t('inventory.costPrice'), product.cost_price, formatCurrency(product.cost_price)],
    [t('inventory.price'), product.price, formatCurrency(product.price)],
    [t('inventory.stock'), product.stock, `${formatNumber(product.stock)} ${product.unit}`],
    [t('common.status'), status, status],
  ]
  return rows.map(([label, raw, shown]) => ({ [label]: raw, [value]: shown }))
}

function historySheets(history: ProductHistory, t: Translate) {
  const inventory = (key: string) => t(`inventory.${key}`)
  return [
    {
      name: inventory('movementHistory'),
      rows: history.movements.map((m) => ({
        [inventory('movementType')]: inventory(isIncoming(m) ? 'stockIn' : 'stockOut'),
        [inventory('quantity')]: m.quantity,
        [inventory('before')]: m.quantity_before,
        [inventory('after')]: m.quantity_after,
        [inventory('reason')]: translateMovementReason(m.reason, inventory),
        [t('common.date')]: formatDateTime(m.created_at),
      })),
    },
    {
      name: inventory('salesHistory'),
      rows: history.sales.map((s) => ({
        [t('sales.orderNumber')]: s.sales_orders?.order_number ?? '—',
        [t('sales.customer')]: s.sales_orders?.customers?.name ?? '—',
        [inventory('quantity')]: s.quantity,
        [t('sales.totalPrice')]: s.total_price,
        [t('common.date')]: dateOf(s.sales_orders?.created_at),
      })),
    },
    {
      name: inventory('purchaseHistory'),
      rows: history.purchases.map((p) => ({
        [t('procurement.poNumber')]: p.purchase_orders?.po_number ?? '—',
        [t('procurement.supplier')]: p.purchase_orders?.suppliers?.name ?? '—',
        [inventory('quantity')]: p.quantity,
        [t('procurement.totalCost')]: p.total_cost,
        [t('common.date')]: dateOf(p.purchase_orders?.created_at),
      })),
    },
  ]
}

export const exportProductDetail = (product: any, history: ProductHistory, t: Translate) =>
  downloadWorkbook(`${product.name.replace(/\s+/g, '_')}_details_report.xlsx`, [
    { name: t('inventory.excel.generalInfoSheet'), rows: infoSheet(product, t) },
    ...historySheets(history, t),
  ])
