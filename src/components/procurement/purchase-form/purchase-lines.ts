export interface PurchaseProduct {
  id: string
  name: string
  price: number
  cost_price: number
  stock: number
  unit: string
  sku: string
}

export interface PurchaseCashbox {
  id: string
  name: string
  type: string
  balance: number
}

export interface PurchaseLine {
  /** Empty for a scanned line that matched no product yet. */
  productId: string
  productName: string
  quantity: number
  unitCost: number
  totalCost: number
}

const withTotal = (line: PurchaseLine): PurchaseLine => ({ ...line, totalCost: line.quantity * line.unitCost })

/** One click adds the product at its last cost; a second click bumps it. Unmatched scan rows are never merged. */
export function addProductLine(lines: PurchaseLine[], product: PurchaseProduct): PurchaseLine[] {
  const existing = lines.find((line) => line.productId === product.id)
  if (existing) return lines.map((line) => (line === existing ? withTotal({ ...line, quantity: line.quantity + 1 }) : line))
  const cost = Number(product.cost_price) || 0
  return [...lines, { productId: product.id, productName: product.name, quantity: 1, unitCost: cost, totalCost: cost }]
}

export const updateLine = (lines: PurchaseLine[], index: number, patch: Partial<PurchaseLine>) =>
  lines.map((line, i) => (i === index ? withTotal({ ...line, ...patch }) : line))

export const removeLine = (lines: PurchaseLine[], index: number) => lines.filter((_, i) => i !== index)

export const totalOf = (lines: PurchaseLine[]) => lines.reduce((sum, line) => sum + line.totalCost, 0)

export const unmatchedLines = (lines: PurchaseLine[]) => lines.filter((line) => !line.productId)

/** `receive_purchase` labels the expense by method; the drawer itself is what the user picks. */
export function paymentMethodOf(cashbox: PurchaseCashbox | null): 'cash' | 'card' | 'transfer' | null {
  if (!cashbox) return null
  return cashbox.type === 'card' || cashbox.type === 'transfer' ? cashbox.type : 'cash'
}

const contains = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase())

export const matchSupplier = (suppliers: { id: string; name: string }[], scanned: string) =>
  suppliers.find((s) => contains(s.name, scanned) || contains(scanned, s.name))

export function scannedLines(rows: any[], products: PurchaseProduct[], unknownLabel: string): PurchaseLine[] {
  return rows.map((row) => {
    const match = products.find((p) => contains(p.name, row.name ?? '') || (row.sku && p.sku.toLowerCase() === String(row.sku).toLowerCase()))
    const quantity = row.quantity ?? row.stock ?? 1
    const unitCost = row.cost_price ?? row.price ?? 0
    return { productId: match?.id ?? '', productName: row.name ?? unknownLabel, quantity, unitCost, totalCost: quantity * unitCost }
  })
}
