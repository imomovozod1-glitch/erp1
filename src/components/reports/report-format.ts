import { formatNumber } from '@/lib/utils'

/** Quantities may be fractional (kg, m); two decimals is all a report needs. */
export const formatQty = (value: number) => formatNumber(Math.round(value * 100) / 100)
