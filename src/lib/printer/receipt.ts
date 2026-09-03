import { EscPosBuilder } from './escpos'
import { formatCurrency } from '@/lib/utils'

export interface ReceiptItem {
  name: string
  quantity: number
  price: number
  discount: number
  total: number
}

export interface ReceiptOrder {
  orderNumber: string
  date: string
  cashier: string
  customerName: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
}

export interface ReceiptCompanyInfo {
  name: string
  address?: string
  phone?: string
}

export interface ReceiptLabels {
  receipt: string
  date: string
  cashier: string
  customer: string
  subtotal: string
  discount: string
  tax: string
  total: string
  paymentMethod: string
  thankYou: string
}

/** Paper widths in character columns at the standard 12x24 font — 58mm and 80mm cover the whole thermal-receipt-printer market. */
export const PAPER_WIDTH_COLUMNS = { '58mm': 32, '80mm': 48 } as const
export type PaperWidth = keyof typeof PAPER_WIDTH_COLUMNS

export function buildReceiptBytes(
  order: ReceiptOrder,
  company: ReceiptCompanyInfo,
  labels: ReceiptLabels,
  opts: { paperWidth: PaperWidth; cyrillic: boolean; codepage: number; openDrawer: boolean }
): Uint8Array {
  const cols = PAPER_WIDTH_COLUMNS[opts.paperWidth]
  const p = new EscPosBuilder({ columns: cols, cyrillic: opts.cyrillic, codepage: opts.codepage })

  p.align('center').bold(true).size(1, 1).line(company.name).bold(false)
  if (company.address) p.line(company.address)
  if (company.phone) p.line(company.phone)
  p.hr('=')

  p.align('left')
  p.row(labels.receipt, `#${order.orderNumber}`)
  p.row(labels.date, order.date)
  p.row(labels.cashier, order.cashier)
  p.row(labels.customer, order.customerName)
  p.hr()

  for (const item of order.items) {
    p.line(item.name)
    const qtyPrice = `${item.quantity} x ${formatCurrency(item.price)}${item.discount > 0 ? ` (-${item.discount}%)` : ''}`
    p.row(qtyPrice, formatCurrency(item.total))
  }
  p.hr()

  p.row(labels.subtotal, formatCurrency(order.subtotal))
  if (order.discount > 0) p.row(labels.discount, `-${formatCurrency(order.discount)}`)
  if (order.tax > 0) p.row(labels.tax, formatCurrency(order.tax))
  p.bold(true).size(1, 2)
  p.row(labels.total, formatCurrency(order.total))
  p.size(1, 1).bold(false)
  p.row(labels.paymentMethod, order.paymentMethod.toUpperCase())
  p.hr()

  p.align('center')
  p.line(labels.thankYou)
  p.feed(1)

  if (opts.openDrawer) p.openDrawer()
  p.cut()

  return p.toBytes()
}
