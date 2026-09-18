/**
 * Calling the three production database functions (supabase/migration_production.sql).
 *
 * Saving a draft, completing a run and cancelling one are each a single
 * transaction that checks the caller's `production` permission itself — see
 * `@/lib/business-rpc` for the shared refusal contract and why these are not
 * browser writes.
 *
 * Unlike sales and purchases there is NO pre-migration browser fallback here:
 * production is a new module, so a tenant that has the screens has the
 * functions. `RPC_MISSING` therefore surfaces as a plain error telling the
 * operator the migration has not been applied.
 */

import { callBusinessRpc, RPC_MISSING, BusinessRpcError } from '@/lib/business-rpc'
import { formatNumber } from '@/lib/utils'

export interface ProductionLineInput {
  component_id: string
  quantity: number
}

export interface SaveProductionOrderInput {
  id?: string
  order_number: string
  bom_id?: string | null
  product_id: string
  quantity: number
  planned_date?: string | null
  extra_cost?: number
  notes?: string | null
  assigned_to?: string | null
  items: ProductionLineInput[]
}

/** Thrown when the migration has not been applied on this deployment yet. */
export class ProductionRpcMissingError extends Error {
  constructor() {
    super('production_rpc_missing')
    this.name = 'ProductionRpcMissingError'
  }
}

async function call<T extends object>(supabase: any, fn: string, args: Record<string, unknown>): Promise<T> {
  const result = await callBusinessRpc<T>(supabase, fn, args)
  if (result === RPC_MISSING) throw new ProductionRpcMissingError()
  return result
}

export function saveProductionOrder(supabase: any, input: SaveProductionOrderInput) {
  return call<{ ok: true; id: string }>(supabase, 'save_production_order', { p_order: input })
}

export function completeProductionOrder(supabase: any, orderId: string, today: string) {
  return call<{ ok: true; total_cost: number; unit_cost: number }>(supabase, 'complete_production_order', {
    p_order_id: orderId,
    p_today: today,
  })
}

export function cancelProductionOrder(supabase: any, orderId: string) {
  return call<{ ok: true; reversed: boolean }>(supabase, 'cancel_production_order', { p_order_id: orderId })
}

/**
 * The toast for a production refusal. Codes the shared
 * `businessRpcErrorMessage` does not know about are handled here; the rest
 * fall through to it.
 */
export function productionErrorMessage(
  t: (key: string, values?: Record<string, string | number>) => string,
  error: unknown,
  fallback: (error: BusinessRpcError) => string
): string {
  if (error instanceof ProductionRpcMissingError) return t('production.migrationMissing')
  if (!(error instanceof BusinessRpcError)) {
    return (error as Error)?.message || t('common.error')
  }
  const details = error.details as Record<string, any>
  switch (error.code as string) {
    case 'duplicate_number':
      return t('production.duplicateNumber')
    case 'not_draft':
      return t('production.notDraft')
    case 'already_cancelled':
      return t('production.alreadyCancelled')
    case 'insufficient_stock':
      return t('production.insufficientComponent', {
        product: details.product_name ?? '—',
        available: formatNumber(Number(details.available) || 0),
        required: formatNumber(Number(details.required) || 0),
      })
    default:
      return fallback(error)
  }
}
