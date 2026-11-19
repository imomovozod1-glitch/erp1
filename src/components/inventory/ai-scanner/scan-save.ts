import { recordStockChange } from '@/lib/stock-ledger'
import type { ScannedItem } from './scan-image'

export interface NamedCategory {
  id: string
  name: string
}

const DEFAULT_MIN_STOCK = 5

const categoryIdOf = (name: string | undefined, categories: NamedCategory[]) =>
  (name && categories.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id) || null

const toProductRow = (item: ScannedItem, categories: NamedCategory[]) => ({
  name: item.name.trim(),
  sku: item.sku.trim(),
  unit: item.unit.trim() || 'dona',
  stock: Number(item.stock) || 0,
  min_stock: DEFAULT_MIN_STOCK,
  price: Number(item.price) || 0,
  cost_price: Number(item.cost_price) || 0,
  category_id: categoryIdOf(item.category, categories),
  is_active: true,
})

const openingStock = (product: any, userId: string | null) => ({
  productId: product.id,
  before: 0,
  after: Number(product.stock) || 0,
  unitCost: Number(product.cost_price) || 0,
  layerSource: 'ai_scan' as const,
  referenceType: 'ai_scan',
  reason: 'AI stock scanner — new product',
  userId,
})

export const hasMissingIdentity = (items: ScannedItem[]) => items.some((item) => !item.name.trim() || !item.sku.trim())

export async function saveScannedItems(supabase: any, items: ScannedItem[], categories: NamedCategory[]) {
  const { data: auth } = await supabase.auth.getUser()
  const { data: created, error } = await supabase
    .from('products')
    .insert(items.map((item) => toProductRow(item, categories)))
    .select()
  if (error) throw error
  for (const product of created ?? []) await recordStockChange(supabase, openingStock(product, auth?.user?.id ?? null))
}
