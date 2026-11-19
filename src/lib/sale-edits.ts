'use client'

import { SaleEditError, type SaleEditResult, type SaleLineEdit } from '@/lib/sales/sale-edit-model'
import { updateSaleLinesInBrowser } from '@/lib/sales/update-sale-lines-in-browser'
import { isoDate } from '@/lib/utils'
import { BusinessRpcError, callBusinessRpc, RPC_MISSING } from '@/lib/business-rpc'

export { saleLineTotal, saleOrderTotal, SaleEditError, type SaleEditResult, type SaleLineEdit } from '@/lib/sales/sale-edit-model'

/**
 * Editing the lines of a sale that has already happened.
 *
 * A sale's lines are not just rows: they took goods out of stock, and their sum
 * is what went into a cashbox or onto the customer's debt. So changing one has
 * to carry through:
 *
 *   - a removed line goes back into stock (`returnLinesToStock`) and is deleted;
 *   - a new price rewrites the line total, and the order total is recomputed the
 *     way the till computes it (lines − order discount + tax);
 *   - the difference against the old total moves money: a cash/card/transfer
 *     sale gets it added to / taken out of its cashbox and its income
 *     transaction corrected; a debt sale gets its invoice total changed, which
 *     is what the customer's debt is computed from — and if they had already
 *     paid more than the new total, the excess becomes credit (haqdorlik).
 *
 * All of it happens in the `update_sale_lines` database function — one
 * transaction, with the order, its lines, invoice and cashbox locked, and the
 * caller's permission checked (supabase/migration_business_rpc.sql).
 * `updateSaleLinesInBrowser` below is the old multi-request path, kept only
 * until that migration is applied everywhere.
 */

export async function updateSaleLines(
  supabase: any,
  orderId: string,
  edits: SaleLineEdit[],
  userId: string | null
): Promise<SaleEditResult> {
  let result
  try {
    result = await callBusinessRpc<{
      changed: boolean
      new_total: number
      cashbox_delta: number
      cashbox_name: string | null
      credit_added: number
    }>(supabase, 'update_sale_lines', {
      p_order_id: orderId,
      p_edits: edits.map((edit) => ({ id: edit.id, unit_price: edit.unitPrice, remove: edit.remove })),
      p_today: isoDate(),
    })
  } catch (error) {
    if (error instanceof BusinessRpcError) {
      // update_sale_lines only refuses with the codes SaleEditError knows.
      throw new SaleEditError(
        error.code as SaleEditError['code'],
        {
          cashboxName: error.details.cashbox_name ?? undefined,
          balance: Number(error.details.balance) || 0,
          amount: Number(error.details.amount) || 0,
        }
      )
    }
    throw error
  }
  if (result === RPC_MISSING) return updateSaleLinesInBrowser(supabase, orderId, edits, userId)

  return {
    changed: result.changed,
    newTotal: Number(result.new_total) || 0,
    cashboxDelta: Number(result.cashbox_delta) || 0,
    cashboxName: result.cashbox_name ?? null,
    creditAdded: Number(result.credit_added) || 0,
  }
}
