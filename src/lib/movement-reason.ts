/**
 * Stock movement `reason` is free-form English text written at insert time
 * (see product-form.tsx, sale-form.tsx, pos-client.tsx, purchase-order-form.tsx,
 * ai-stock-scanner-modal.tsx), not a fixed enum — so translation has to
 * pattern-match the known templates and localize them, preserving any
 * interpolated order number/supplier name. Shared between product-detail-client.tsx
 * and movements-table.tsx so both stay in sync with the same mapping.
 */
export function translateMovementReason(reason: string | null | undefined, lang: string): string {
  if (!reason) return '—'
  if (reason === 'Manual adjustment in product form') {
    return lang === 'uz' ? "Mahsulot shaklida qo'lda tuzatish" : lang === 'ru' ? 'Ручная корректировка в форме товара' : reason
  }
  if (reason === 'Initial stock on product creation') {
    return lang === 'uz' ? "Mahsulot yaratilganda boshlang'ich zaxira" : lang === 'ru' ? 'Начальный запас при создании товара' : reason
  }
  if (reason === 'POS Sale') {
    return lang === 'uz' ? 'POS sotuvi' : lang === 'ru' ? 'Продажа через POS' : reason
  }
  if (reason === 'AI stock scanner — new product') {
    return lang === 'uz' ? 'AI skaner — yangi mahsulot' : lang === 'ru' ? 'AI-сканер — новый товар' : reason
  }
  if (reason.startsWith('Sale ')) {
    const orderNumber = reason.slice('Sale '.length)
    return lang === 'uz' ? `Sotuv ${orderNumber}` : lang === 'ru' ? `Продажа ${orderNumber}` : reason
  }
  if (reason.startsWith('Purchase from ')) {
    const supplier = reason.slice('Purchase from '.length)
    return lang === 'uz' ? `Xarid: ${supplier}` : lang === 'ru' ? `Закупка: ${supplier}` : reason
  }
  return reason
}
