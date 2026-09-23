/**
 * Cancelling a purchase.
 *
 * The whole reversal — stock off the shelf, the cost layers this purchase
 * created, the money paid for it back in the cashbox, the order marked
 * cancelled — runs in one database transaction
 * (supabase/migration_purchase_payment.sql), for the same reason cancelling a
 * sale does: half a reversal is worse than none.
 *
 * There is deliberately NO browser fallback here, unlike the sale path. That
 * fallback exists because `cancel_sales_order` replaced code that already
 * worked in the browser; this reverses stock, FIFO layers and a cashbox at
 * once, and a sequence of separate calls that fails halfway would leave the
 * books in a state nobody could reconstruct. Until the migration is applied
 * the action says so plainly instead.
 */

export type PurchaseCancelCode =
  | 'forbidden'
  | 'not_found'
  | 'already_cancelled'
  | 'already_sold'
  | 'insufficient_stock'
  | 'rpc_missing'

export class PurchaseCancelError extends Error {
  code: PurchaseCancelCode
  /** The product that blocked it, for 'already_sold' / 'insufficient_stock'. */
  productName?: string | null

  constructor(code: PurchaseCancelCode, productName?: string | null) {
    super(code)
    this.name = 'PurchaseCancelError'
    this.code = code
    this.productName = productName ?? null
  }
}

export interface PurchaseCancelResult {
  /** Money returned to the cashbox, 0 when the purchase was on account. */
  refunded: number
  cashboxName: string | null
}

export async function cancelPurchase(supabase: any, purchaseId: string): Promise<PurchaseCancelResult> {
  const { data, error } = await supabase.rpc('cancel_purchase', { p_po_id: purchaseId })

  if (error) {
    // PGRST202 = the function is not there yet. Migrations are applied by
    // hand, so a deploy can land before its SQL does.
    if (error.code === 'PGRST202') throw new PurchaseCancelError('rpc_missing')
    throw new Error(error.message)
  }

  const result = data as {
    ok: boolean
    code?: PurchaseCancelCode
    product_name?: string | null
    refunded?: number
    cashbox_name?: string | null
  }

  if (!result?.ok) {
    throw new PurchaseCancelError(result?.code ?? 'not_found', result?.product_name)
  }

  return {
    refunded: Number(result.refunded) || 0,
    cashboxName: result.cashbox_name ?? null,
  }
}

/** The message to show for a refusal, in the caller's language. */
export function purchaseCancelMessage(
  t: (key: string, values?: Record<string, string | number>) => string,
  error: unknown
): string {
  if (error instanceof PurchaseCancelError) {
    if (error.code === 'already_sold' || error.code === 'insufficient_stock') {
      return t(`procurement.cancel.${error.code}`, { product: error.productName || '—' })
    }
    return t(`procurement.cancel.${error.code}`)
  }
  return t('common.error')
}
