import { formatDate, formatDateTime } from '@/lib/utils'
import { downloadWorkbook } from '@/components/shared/detail-page'

export interface CustomerActivity {
  salesOrders: any[]
  invoices: any[]
  transactions: any[]
}

type Translate = (key: string) => string

const isOpen = (invoice: any) => invoice.status !== 'paid' && invoice.status !== 'cancelled'
const sum = (rows: any[], pick: (row: any) => number) => rows.reduce((total, row) => total + pick(row), 0)

export function customerMetrics(customer: any, { salesOrders, invoices }: CustomerActivity) {
  const debt = sum(invoices.filter(isOpen), (inv) => (inv.total_amount || 0) - (inv.paid_amount || 0))
  const credit = Number(customer.credit_balance) || 0
  return {
    purchases: sum(salesOrders, (o) => o.total_amount || 0),
    paid: sum(invoices, (inv) => inv.paid_amount || 0),
    debt,
    credit,
    balance: credit - debt,
  }
}

function profileRows(customer: any, t: Translate) {
  const value = t('sales.customerDetail.value')
  const status = t(customer.is_active ? 'common.active' : 'common.inactive')
  const fields: [string, unknown][] = [
    [t('common.name'), customer.name],
    [t('common.email'), customer.email ?? '—'],
    [t('common.phone'), customer.phone ?? '—'],
    [t('sales.tin'), customer.tin ?? '—'],
    [t('common.address'), customer.address ?? '—'],
    [t('common.status'), status],
  ]
  return fields.map(([label, shown]) => ({ [label]: shown, [value]: shown }))
}

export function exportCustomer(customer: any, activity: CustomerActivity, t: Translate) {
  const detail = (key: string) => t(`sales.customerDetail.${key}`)
  return downloadWorkbook(`${customer.name.replace(/\s+/g, '_')}_details.xlsx`, [
    { name: detail('sheetProfile'), rows: profileRows(customer, t) },
    {
      name: detail('sheetOrders'),
      rows: activity.salesOrders.map((o) => ({
        [t('sales.orderNumber')]: o.order_number,
        [t('common.totalAmount')]: o.total_amount,
        [t('common.status')]: t(`sales.status.${o.status}`),
        [t('common.notes')]: o.notes || '—',
        [t('common.date')]: formatDateTime(o.created_at),
      })),
    },
    {
      name: detail('sheetInvoices'),
      rows: activity.invoices.map((inv) => ({
        [t('sales.invoiceNumber')]: inv.invoice_number,
        [t('common.totalAmount')]: inv.total_amount,
        [t('sales.paidAmount')]: inv.paid_amount,
        [t('common.status')]: t(`sales.status.${inv.status}`),
        [t('sales.dueDate')]: formatDate(inv.due_at),
        [detail('issuedDate')]: formatDateTime(inv.created_at),
      })),
    },
    {
      name: detail('sheetPayments'),
      rows: activity.transactions.map((tx) => ({
        [t('common.type')]: detail(tx.type === 'income' ? 'income' : 'expense'),
        [t('common.category')]: tx.category,
        [t('common.amount')]: tx.amount,
        [t('common.date')]: formatDateTime(tx.created_at),
        [detail('note')]: tx.description || '—',
      })),
    },
  ])
}
