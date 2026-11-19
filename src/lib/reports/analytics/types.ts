export interface SalesOrderRow {
  id: string
  order_number: string
  order_date: string | null
  total_amount: number
  customer_id: string | null
  customer_name: string
  seller_id: string | null
  seller_name: string
}

export interface SalesItemRow {
  order_id: string
  product_id: string | null
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  unit_cost: number
  /** Already net of the order's general discount. */
  revenue: number
  order_date: string | null
  customer_id: string | null
  seller_id: string | null
}

export interface CatalogProductRow {
  id: string
  name: string
  sku: string
  stock: number
  price: number
  cost_price: number
  is_active: boolean
  /** True for a service (migration_services.sql) — no stock, so no shelf. */
  is_service?: boolean
}

export interface DateRange {
  start: Date | null
  end: Date | null
}
