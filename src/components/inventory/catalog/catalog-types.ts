export type CatalogKind = 'products' | 'services'
export type CatalogStatus = 'all' | 'active' | 'inactive'

export interface CatalogItem {
  id: string
  name: string
  sku: string
  price: number
  cost_price: number
  unit: string
  is_active: boolean
  description?: string | null
  image_url?: string | null
  stock?: number
  min_stock?: number
  incoming_cost?: number | null
  categories?: { name: string } | null
}

export interface CatalogPage {
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
  status: CatalogStatus
}

export const catalogHref = (lang: string, kind: CatalogKind, id: string, edit = false) =>
  `/${lang}/inventory/${kind}/${id}${edit ? '/edit' : ''}`

export function marginOf(item: Pick<CatalogItem, 'price' | 'cost_price'>): number | null {
  const price = Number(item.price) || 0
  return price > 0 ? ((price - (Number(item.cost_price) || 0)) / price) * 100 : null
}

export type StockState = 'out' | 'low' | 'ok'

export function stockStateOf(item: Pick<CatalogItem, 'stock' | 'min_stock'>): StockState {
  const stock = Number(item.stock) || 0
  if (stock <= 0) return 'out'
  return stock <= (Number(item.min_stock) || 0) ? 'low' : 'ok'
}
