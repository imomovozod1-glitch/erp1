import { getEffectiveCostingMethod } from '@/lib/inventory-costing'
import { recordStockChange } from '@/lib/stock-ledger'
import type { ImportedProduct } from './product-import-parse'

const SKU_CHUNK = 200

const chunks = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

async function readStockBySku(supabase: any, skus: string[]) {
  const results = await Promise.all(
    chunks(skus, SKU_CHUNK).map((chunk) => supabase.from('products').select('sku, stock').in('sku', chunk))
  )
  return new Map<string, number>(
    results.flatMap(({ data }: any) => data ?? []).map((p: any) => [String(p.sku), Number(p.stock) || 0])
  )
}

interface SavedProduct {
  id: string
  sku: string
  stock: number
  cost_price: number
}

export async function saveImportedProducts(supabase: any, products: ImportedProduct[]) {
  const [stockBySku, { data: tenant }, { data: auth }] = await Promise.all([
    readStockBySku(supabase, products.map((p) => p.sku)),
    supabase.from('tenants').select('costing_method').limit(1).single(),
    supabase.auth.getSession(),
  ])

  const { data: saved, error } = await supabase
    .from('products')
    .upsert(products, { onConflict: 'tenant_id,sku' })
    .select('id, sku, stock, cost_price')
  if (error) throw error

  const method = getEffectiveCostingMethod(tenant)
  const userId = auth?.session?.user?.id ?? null
  await Promise.all(
    (saved ?? []).map((product: SavedProduct) => {
      const before = stockBySku.get(String(product.sku)) ?? 0
      return recordStockChange(
        supabase,
        {
          productId: product.id,
          before,
          after: Number(product.stock) || 0,
          unitCost: Number(product.cost_price) || 0,
          layerSource: before === 0 ? 'initial_stock' : 'adjustment',
          referenceType: 'excel_import',
          reason: 'Excel import',
          userId,
        },
        method
      )
    })
  )
}
