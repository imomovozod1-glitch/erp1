import { isService } from '@/lib/product-kind'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'debt'

export interface SaleProduct {
  id: string
  name: string
  price: number
  cost_price: number
  stock: number
  unit: string
  sku: string
  is_service?: boolean
}

export interface SaleItem {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  stock: number
  totalPrice: number
}

const withTotal = (item: SaleItem): SaleItem => ({ ...item, totalPrice: item.quantity * item.unitPrice })

export const exceedsStock = (product: SaleProduct, quantity: number) => !isService(product) && quantity > product.stock

/** The lines after one click on a product, or null when the shelf cannot cover it. */
export function addProductLine(items: SaleItem[], product: SaleProduct): SaleItem[] | null {
  const existing = items.find((item) => item.productId === product.id)
  const quantity = (existing?.quantity ?? 0) + 1
  if (exceedsStock(product, quantity)) return null
  if (existing) return items.map((item) => (item === existing ? withTotal({ ...item, quantity }) : item))
  return [
    ...items,
    { productId: product.id, productName: product.name, unitPrice: product.price, quantity: 1, stock: product.stock, totalPrice: product.price },
  ]
}

export const updateLine = (items: SaleItem[], index: number, patch: Partial<Pick<SaleItem, 'quantity' | 'unitPrice'>>) =>
  items.map((item, i) => (i === index ? withTotal({ ...item, ...patch }) : item))

export const removeLine = (items: SaleItem[], index: number) => items.filter((_, i) => i !== index)

export const totalOf = (items: SaleItem[]) => items.reduce((sum, item) => sum + item.totalPrice, 0)

export function quantityByProduct(items: SaleItem[]) {
  const totals = new Map<string, number>()
  for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity)
  return totals
}
