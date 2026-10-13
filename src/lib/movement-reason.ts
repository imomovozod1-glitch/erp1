/**
 * Stock movement `reason` is free-form English text written at insert time
 * (see product-form.tsx, sale-form.tsx, pos-client.tsx, purchase-order-form.tsx,
 * products-table.tsx (Excel import), ai-stock-scanner-modal.tsx, and
 * complete_production_order/cancel_production_order
 * in supabase/migration_production.sql), not a fixed enum — so translation has to
 * pattern-match the known templates and localize them, preserving any
 * interpolated order number/supplier name. Shared between product-detail-client.tsx
 * and movements-table.tsx so both stay in sync with the same mapping.
 *
 * `t` is the `inventory` translator; the texts live under
 * `inventory.movementReasons.*`. Anything unrecognised is shown as written.
 */
type InventoryTranslator = (key: any, values?: any) => string

const FIXED_REASONS: Record<string, string> = {
  'Manual adjustment in product form': 'movementReasons.manualAdjustment',
  'Initial stock on product creation': 'movementReasons.initialStock',
  'POS Sale': 'movementReasons.posSale',
  'Excel import': 'movementReasons.excelImport',
  'AI stock scanner — new product': 'movementReasons.aiScan',
}

export function translateMovementReason(reason: string | null | undefined, t: InventoryTranslator): string {
  if (!reason) return '—'
  const fixed = FIXED_REASONS[reason]
  if (fixed) return t(fixed)
  if (reason.startsWith('Sale ')) {
    return t('movementReasons.sale', { number: reason.slice('Sale '.length) })
  }
  // Written by cancel_production_order — checked before the 'Production '
  // prefix below, which it also starts with.
  if (reason.startsWith('Production cancelled ')) {
    return t('movementReasons.productionCancelled', { number: reason.slice('Production cancelled '.length) })
  }
  if (reason.startsWith('Production ')) {
    return t('movementReasons.production', { number: reason.slice('Production '.length) })
  }
  if (reason.startsWith('Purchase from ')) {
    return t('movementReasons.purchase', { supplier: reason.slice('Purchase from '.length) })
  }
  return reason
}
