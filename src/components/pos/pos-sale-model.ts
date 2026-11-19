import { isService } from '@/lib/product-kind'
import type { ReceiptOrder } from '@/components/pos/pos-receipt-dialog'
import type { CartItem } from '@/components/pos/use-pos-cart'
import type { PosPaymentMethod } from '@/components/pos/checkout'

export interface SaleTotals {
  subtotal: number
  discount: number
  tax: number
  total: number
}

export const linePrice = (item: CartItem) => item.product.price * (1 - item.discountPercent / 100)
export const lineTotal = (item: CartItem) => linePrice(item) * item.quantity

const isSoldOut = (product: any) => !isService(product) && product.stock <= 0

/** Search by name or SKU within a category; sold-out goods stay listed but sink to the end. */
export function filterCatalogue(products: any[], query: string, category: string) {
  const needle = query.trim().toLowerCase()
  const matches = products.filter(
    (p) =>
      (!needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)) &&
      (category === 'all' || p.category_id === category)
  )
  return matches.sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)))
}

export const findBySku = (products: any[], sku: string) => products.find((p) => p.sku.toLowerCase() === sku.trim().toLowerCase())

const soldQuantity = (sold: CartItem[], product: any) =>
  isService(product) ? undefined : sold.find((item) => item.product.id === product.id)?.quantity

/** Moves each sold product's stock by `sign × quantity`; a service has no stock to move. */
export function shiftStock(products: any[], sold: CartItem[], sign: 1 | -1) {
  return products.map((p) => {
    const quantity = soldQuantity(sold, p)
    return quantity === undefined ? p : { ...p, stock: p.stock + sign * quantity }
  })
}

/** Re-bases the sold products on the stock the database actually deducted from. */
export function stockFromDatabase(products: any[], sold: CartItem[], stockBefore: Map<string, number>) {
  return products.map((p) => {
    const quantity = soldQuantity(sold, p)
    return quantity === undefined || !stockBefore.has(p.id) ? p : { ...p, stock: (stockBefore.get(p.id) as number) - quantity }
  })
}

/** The lines this sale pushed to or below their minimum stock level. */
export function lowStockAlerts(sold: CartItem[], stockBefore: Map<string, number>) {
  return sold.flatMap((item) => {
    const stock = (stockBefore.get(item.product.id) ?? item.product.stock) - item.quantity
    const minStock = Number(item.product.min_stock) || 0
    return minStock > 0 && stock <= minStock ? [{ productName: item.product.name, sku: item.product.sku, stock, minStock }] : []
  })
}

interface ReceiptInput {
  orderNumber: string
  cashier: string
  customerName: string
  items: CartItem[]
  totals: SaleTotals
  paymentMethod: PosPaymentMethod
}

export const receiptOf = ({ orderNumber, cashier, customerName, items, totals, paymentMethod }: ReceiptInput): ReceiptOrder => ({
  orderNumber,
  date: new Date().toLocaleString(),
  cashier,
  customerName,
  items: items.map((item) => ({
    name: item.product.name,
    quantity: item.quantity,
    price: item.product.price,
    discount: item.discountPercent,
    total: lineTotal(item),
  })),
  ...totals,
  paymentMethod,
})
