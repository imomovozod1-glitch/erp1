/**
 * Calling the delivery status function (supabase/migration_distribution.sql).
 *
 * Only the status move goes through the database: it carries the sales order
 * along with it, and doing that from the browser would be two writes that can
 * half-fail. Creating and editing a route or a delivery moves nothing, so
 * those are ordinary browser writes — see CLAUDE.md § Data layer.
 */

import { callBusinessRpc, RPC_MISSING, BusinessRpcError } from '@/lib/business-rpc'
import type { DeliveryStatus } from '@/lib/statuses'

/** Thrown when the migration has not been applied on this deployment yet. */
export class DistributionRpcMissingError extends Error {
  constructor() {
    super('distribution_rpc_missing')
    this.name = 'DistributionRpcMissingError'
  }
}

export interface DeliveryStatusResult {
  ok: true
  status: DeliveryStatus
  /** The sales order's new status, or null when it was left where it was. */
  order_status: string | null
}

export async function setDeliveryStatus(
  supabase: any,
  deliveryId: string,
  status: DeliveryStatus,
  today: string
): Promise<DeliveryStatusResult> {
  const result = await callBusinessRpc<DeliveryStatusResult>(supabase, 'set_delivery_status', {
    p_delivery_id: deliveryId,
    p_status: status,
    p_today: today,
  })
  if (result === RPC_MISSING) throw new DistributionRpcMissingError()
  return result
}

/**
 * The toast for a distribution refusal. Codes the shared
 * `businessRpcErrorMessage` already knows fall through to it.
 */
export function distributionErrorMessage(
  t: (key: string, values?: Record<string, string | number>) => string,
  error: unknown,
  fallback: (error: BusinessRpcError) => string
): string {
  if (error instanceof DistributionRpcMissingError) return t('distribution.migrationMissing')
  if (!(error instanceof BusinessRpcError)) {
    return (error as Error)?.message || t('common.error')
  }
  return fallback(error)
}
