import { recordStockChange, tenantCostingMethod } from '@/lib/stock-ledger'
import { catalogPayload, currentUserId, writeCatalogRow } from '../catalog-form/catalog-save'
import type { ProductFormData } from '../catalog-form/catalog-form-schema'

interface SaveProductInput {
  supabase: any
  data: ProductFormData
  initial: any
  imageUrl: string | null
}

function stockChange(productId: string, before: number, payload: Record<string, any>, userId: string | null, isNew: boolean) {
  return {
    productId,
    before,
    after: Number(payload.stock) || 0,
    unitCost: Number(payload.cost_price) || 0,
    layerSource: isNew ? ('initial_stock' as const) : ('adjustment' as const),
    referenceType: isNew ? 'initial_stock' : 'product_adjustment',
    reason: isNew ? 'Initial stock on product creation' : 'Manual adjustment in product form',
    userId,
  }
}

export async function saveProduct({ supabase, data, initial, imageUrl }: SaveProductInput) {
  const userId = await currentUserId(supabase)
  const payload = catalogPayload(data, initial, userId, { image_url: imageUrl })
  const saved = await writeCatalogRow(supabase, payload, initial?.id)
  const productId = initial?.id ?? saved?.id
  if (!productId) return
  const before = initial ? Number(initial.stock) || 0 : 0
  await recordStockChange(supabase, stockChange(productId, before, payload, userId, !initial), () => tenantCostingMethod(supabase))
}
