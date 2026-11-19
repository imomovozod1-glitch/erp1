export interface MovementSource {
  type?: string
  label?: string
  supplierOrCustomer?: string
}

export interface ProductMovement {
  id: string
  type: string
  quantity: number
  quantity_before: number
  quantity_after: number
  reason?: string | null
  created_at: string
  source?: MovementSource | null
}

export interface ProductSaleLine {
  quantity: number
  total_price: number
  sales_orders?: { order_number?: string; created_at?: string; customers?: { name?: string } | null } | null
}

export interface ProductPurchaseLine {
  quantity: number
  total_cost: number
  purchase_orders?: { po_number?: string; created_at?: string; suppliers?: { name?: string } | null } | null
}

export interface ProductCostLayer {
  id: string
  received_at: string
  source_type: string
  quantity: number
  remaining_qty: number
  unit_cost: number
}

export interface ProductHistory {
  movements: ProductMovement[]
  sales: ProductSaleLine[]
  purchases: ProductPurchaseLine[]
  costLayers: ProductCostLayer[]
}

export const isIncoming = (movement: Pick<ProductMovement, 'type'>) => movement.type === 'incoming' || movement.type === 'in'

export const COST_LAYER_SOURCE_KEYS: Record<string, string> = {
  purchase_order: 'costLayerSources.purchaseOrder',
  initial_stock: 'costLayerSources.initialStock',
  adjustment: 'costLayerSources.adjustment',
  ai_scan: 'costLayerSources.aiScan',
  opening_balance: 'costLayerSources.openingBalance',
  production: 'costLayerSources.production',
  production_cancellation: 'costLayerSources.productionCancellation',
  sale_cancellation: 'costLayerSources.saleCancellation',
}
