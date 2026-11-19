'use client'

import { useTranslations } from 'next-intl'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

type Cell = string | number | null

/** `type` columns come back as raw enum keys (income / in / adjustment …); the rest by column type. */
export function useCellFormat() {
  const t = useTranslations('reports')
  const typeLabel = (value: Cell) => (typeof value === 'string' && t.has(`typeValue.${value}`) ? t(`typeValue.${value}`) : value)
  const format = (value: Cell, type: string, key?: string) => {
    if (value === null || value === '') return '—'
    if (key === 'type') return String(typeLabel(value))
    if (type === 'money') return formatCurrency(Number(value))
    if (type === 'number') return formatNumber(Number(value))
    if (type === 'date') return formatDate(String(value))
    return String(value)
  }
  return { format, typeLabel }
}
