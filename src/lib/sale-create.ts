/**
 * Ringing up a sale through the `create_sale` Postgres function
 * (supabase/migration_business_rpc.sql).
 *
 * The function does everything a sale writes — order, lines, stock and
 * movements, cost layers, customer credit, income transaction, cashbox,
 * invoice — in one transaction with the stock rows locked, and checks the
 * caller's permission. Shared by the POS till (`channel: 'pos'`) and the sale
 * form (`channel: 'form'`), which differ only in the status, texts and
 * assignee the function writes.
 */

export type SaleChannel = 'pos' | 'form'
export type SalePaymentMethod = 'cash' | 'card' | 'transfer' | 'debt'

export interface CreateSaleInput {
  channel: SaleChannel
  orderNumber: string
  invoiceNumber: string
  customerId: string | null
  paymentMethod: SalePaymentMethod
  /** Form only — the POS always assigns the sale to the cashier. */
  assignedTo?: string | null
  totals: { total: number; discount?: number; tax?: number }
  /** `YYYY-MM-DD`, local time (`isoDate()`). */
  orderDate: string
  /** When a debt sale falls due. */
  dueDate: string
  items: {
    productId: string
    quantity: number
    unitPrice: number
    discountPercent?: number
    totalPrice: number
  }[]
}

export interface CreateSaleResult {
  orderId: string
  invoiceNumber: string
  /** Stock the database held a moment before the sale, per product id. */
  stockBefore: Map<string, number>
  /** Customer credit spent on this sale; only ever non-zero on a debt sale. */
  appliedCredit: number
}

export class SaleCreateError extends Error {
  constructor(
    public readonly code: 'insufficient_stock' | 'forbidden' | 'customer_required',
    public readonly details: { productId?: string; productName?: string | null; available?: number } = {}
  ) {
    super(code)
    this.name = 'SaleCreateError'
  }
}

/**
 * Returns `null` when the function is not deployed yet (PostgREST `PGRST202`):
 * migrations are applied by hand, so a deploy can land first and the caller
 * falls back to its browser-side path. Refusals throw `SaleCreateError`;
 * nothing is written in that case.
 */
export async function createSaleRpc(supabase: any, input: CreateSaleInput): Promise<CreateSaleResult | null> {
  const { data, error } = await supabase.rpc('create_sale', {
    p_sale: {
      channel: input.channel,
      order_number: input.orderNumber,
      invoice_number: input.invoiceNumber,
      customer_id: input.customerId,
      payment_method: input.paymentMethod,
      assigned_to: input.assignedTo ?? null,
      total_amount: input.totals.total,
      discount_amount: input.totals.discount ?? 0,
      tax_amount: input.totals.tax ?? 0,
      order_date: input.orderDate,
      due_date: input.dueDate,
      items: input.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent ?? 0,
        total_price: item.totalPrice,
      })),
    },
  })

  if (error) {
    if (error.code === 'PGRST202') return null
    throw new Error(error.message)
  }

  const result = data as {
    ok: boolean
    code?: 'insufficient_stock' | 'forbidden' | 'customer_required'
    order_id?: string
    invoice_number?: string
    applied_credit?: number
    stock_before?: Record<string, number>
    product_id?: string
    product_name?: string | null
    available?: number
  }

  if (!result.ok) {
    throw new SaleCreateError(result.code ?? 'forbidden', {
      productId: result.product_id,
      productName: result.product_name,
      available: Number(result.available) || 0,
    })
  }

  return {
    orderId: result.order_id as string,
    invoiceNumber: result.invoice_number ?? input.invoiceNumber,
    stockBefore: new Map(
      Object.entries(result.stock_before ?? {}).map(([id, stock]) => [id, Number(stock)])
    ),
    appliedCredit: Number(result.applied_credit) || 0,
  }
}
