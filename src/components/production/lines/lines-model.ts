import { isService } from '@/lib/product-kind'

export type Consumption = 'variable' | 'fixed'
export type LinesMode = 'bom' | 'order'

export interface LinesProductOption {
  id: string
  name: string
  unit: string
  stock?: number
  is_service?: boolean
}

export interface MaterialLine {
  productId: string
  quantity: number
  consumption: Consumption
  isExtra: boolean
}

export interface OutputLine {
  productId: string
  quantity: number
  /** Share of the run's cost in percent; `null` while the share switch is off. */
  costShare: number | null
  isExtra: boolean
}

/** 100 split evenly, the remainder on the last row, so the shares always add up. */
export function evenShares(count: number): number[] {
  if (!count) return []
  const each = Math.floor((100 / count) * 100) / 100
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? Number((100 - each * (count - 1)).toFixed(2)) : each))
}

export const costShareTotal = (outputs: OutputLine[]) =>
  Number(outputs.reduce((sum, o) => sum + (Number(o.costShare) || 0), 0).toFixed(2))

export const sharesOn = (outputs: OutputLine[]) => outputs.length > 0 && outputs.every((o) => o.costShare !== null)

export function withShares(rows: OutputLine[], on: boolean): OutputLine[] {
  const shares = evenShares(rows.length)
  return rows.map((o, i) => ({ ...o, costShare: on ? shares[i] : null }))
}

export const sharesOff100 = (outputs: OutputLine[]) => Math.abs(costShareTotal(outputs) - 100) > 0.01

export const quantityTotal = (lines: { quantity: number }[]) => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0)

export const patchAt = <T,>(rows: T[], index: number, patch: Partial<T>) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row))

export const removeAt = <T,>(rows: T[], index: number) => rows.filter((_, i) => i !== index)

/** One more of `productId`: bumps an existing line, else appends `fresh`. */
export function bumpOrAdd<T extends { productId: string; quantity: number }>(rows: T[], productId: string, fresh: T): T[] {
  const at = rows.findIndex((row) => row.productId === productId)
  return at >= 0 ? patchAt(rows, at, { quantity: rows[at].quantity + 1 } as Partial<T>) : [...rows, fresh]
}

export const isShort = (product: LinesProductOption | undefined, quantity: number) =>
  !isService(product) && (Number(product?.stock) || 0) < quantity

/** What is wrong with a recipe or run's lines, as a message key, or null. */
export function linesProblem(materials: MaterialLine[], outputs: OutputLine[]): string | null {
  if (!materials.length || materials.some((m) => !(m.quantity > 0))) return 'production.noComponents'
  if (!outputs.length || outputs.some((o) => !(o.quantity > 0))) return 'production.noOutputs'
  return outputs.every((o) => o.costShare !== null) && sharesOff100(outputs) ? 'production.costShareSum' : null
}
