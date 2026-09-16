import { formatCurrency } from '@/lib/utils'

/**
 * Calling the money/stock database functions (supabase/migration_business_rpc.sql).
 *
 * Every one of them runs as a single transaction, checks the caller's
 * permission, and answers a refusal with `{ ok: false, code, ... }` — nothing
 * is written in that case. This module turns that into a typed error, and
 * `businessRpcErrorMessage` into the toast every screen shows for it.
 *
 * Migrations are applied by hand, so a deploy can land before the functions
 * exist. PostgREST answers that with `PGRST202`, which comes back as
 * `RPC_MISSING` so the caller can fall back to its old browser-side path.
 */

export const RPC_MISSING = Symbol('rpc-missing')
export type RpcMissing = typeof RPC_MISSING

export type BusinessRpcCode =
  | 'forbidden'
  | 'not_found'
  | 'invalid_transition'
  | 'insufficient_cashbox'
  | 'invoice_cancelled'
  | 'order_cancelled'
  | 'no_lines_left'

export class BusinessRpcError extends Error {
  constructor(
    public readonly code: BusinessRpcCode,
    public readonly details: { cashbox_name?: string | null; balance?: number; amount?: number } = {}
  ) {
    super(code)
    this.name = 'BusinessRpcError'
  }
}

export async function callBusinessRpc<T extends object>(
  supabase: any,
  fn: string,
  args: Record<string, unknown>
): Promise<T | RpcMissing> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    if (error.code === 'PGRST202') return RPC_MISSING
    throw new Error(error.message)
  }
  if (data && data.ok === false) {
    throw new BusinessRpcError(data.code, data)
  }
  return data as T
}

/** The toast for a refusal. `t` is the root translator (`useTranslations()`). */
export function businessRpcErrorMessage(
  t: (key: string, values?: Record<string, string | number>) => string,
  error: BusinessRpcError
): string {
  switch (error.code) {
    case 'forbidden':
      return t('common.noPermission')
    case 'not_found':
      return t('common.recordNotFound')
    case 'invalid_transition':
      return t('common.statusChangeNotAllowed')
    case 'invoice_cancelled':
      return t('common.invoiceCancelled')
    case 'order_cancelled':
      return t('sales.cancelSaleAlreadyCancelled')
    case 'no_lines_left':
      return t('sales.noLinesLeft')
    case 'insufficient_cashbox':
      return t('common.insufficientCashbox', {
        cashbox: error.details.cashbox_name ?? '—',
        balance: formatCurrency(Number(error.details.balance) || 0),
        amount: formatCurrency(Number(error.details.amount) || 0),
      })
  }
}
