import { isService } from '@/lib/product-kind'

export interface RunCosting {
  /** A completed run (or one cancelled after completing) shows what it was charged, not today's estimate. */
  actual: boolean
  estimatedTotal: number
  sharesOn: boolean
  unitCostOf: (item: any) => number
  lineTotalOf: (item: any) => number
  outputTotalOf: (output: any) => number
}

const num = (value: unknown) => Number(value) || 0

export function runCosting(order: any, items: any[], outputs: any[]): RunCosting {
  const actual = order.status === 'completed' || (order.status === 'cancelled' && num(order.total_cost) > 0)
  const estimatedTotal = items.reduce((sum, item) => sum + num(item.component?.cost_price) * num(item.quantity), 0) + num(order.extra_cost)
  const sharesOn = outputs.length > 0 && outputs.every((o) => o.cost_share !== null && o.cost_share !== undefined)
  const outputsQty = outputs.reduce((sum, o) => sum + num(o.quantity), 0)
  const unitCostOf = (item: any) => (actual ? num(item.unit_cost) : num(item.component?.cost_price))
  return {
    actual,
    estimatedTotal,
    sharesOn,
    unitCostOf,
    lineTotalOf: (item) => (actual ? num(item.total_cost) : unitCostOf(item) * num(item.quantity)),
    // The split complete_production_order uses: by share when every output has one, else by quantity.
    outputTotalOf: (output) => {
      if (actual) return num(output.total_cost)
      if (sharesOn) return (estimatedTotal * num(output.cost_share)) / 100
      return outputsQty > 0 ? (estimatedTotal * num(output.quantity)) / outputsQty : 0
    },
  }
}

export const isShortLine = (item: any) => !isService(item.component) && num(item.component?.stock) < num(item.quantity)

export const RUN_STATUS_TONE = { draft: 'amber', completed: 'emerald', cancelled: 'rose' } as const
