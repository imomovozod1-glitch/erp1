import { linesProblem, type MaterialLine, type OutputLine } from '../lines/lines-model'

export interface ProductionProductOption {
  id: string
  name: string
  unit: string
  cost_price: number
  stock: number
  is_service?: boolean
}

export interface ProductionBomOption {
  id: string
  name: string
  product_id: string
  output_quantity: number
  product?: { id: string; name: string; unit: string } | null
  items?: { component_id: string; quantity: number; consumption?: string | null }[]
  /** product_bom_outputs; absent before migration_production_outputs.sql. */
  outputs?: { product_id: string; quantity: number; cost_share: number | null; created_at?: string }[]
}

export type RunStatus = 'completed' | 'draft'

export const round3 = (value: number) => Number(value.toFixed(3))
const shareOf = (value: unknown) => (value === null || value === undefined ? null : Number(value))

/** A composition's outputs, oldest first — the first one is the run's main product. */
function bomOutputs(bom: ProductionBomOption) {
  const rows = [...(bom.outputs ?? [])].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
  return rows.length ? rows : [{ product_id: bom.product_id, quantity: Number(bom.output_quantity) || 1, cost_share: null }]
}

/** The lines a composition gives for `times` batches — always from the recipe, so repeated changes cannot drift. */
function deriveLines(bom: ProductionBomOption, times: number, known: Set<string>) {
  return {
    materials: (bom.items ?? [])
      .filter((item) => known.has(item.component_id))
      .map<MaterialLine>((item) => {
        const fixed = item.consumption === 'fixed'
        return { productId: item.component_id, quantity: round3(Number(item.quantity) * (fixed ? 1 : times)), consumption: fixed ? 'fixed' : 'variable', isExtra: false }
      }),
    outputs: bomOutputs(bom)
      .filter((row) => known.has(row.product_id))
      .map<OutputLine>((row) => ({ productId: row.product_id, quantity: round3(Number(row.quantity) * times), costShare: shareOf(row.cost_share), isExtra: false })),
  }
}

/** The composition's lines re-derived, keeping what was added to this run by hand. */
export function applyComposition(current: { materials: MaterialLine[]; outputs: OutputLine[] }, bom: ProductionBomOption | undefined, times: number, known: Set<string>) {
  const extraMaterials = current.materials.filter((m) => m.isExtra)
  const extraOutputs = current.outputs.filter((o) => o.isExtra)
  if (!bom) {
    return { materials: extraMaterials.map((m) => ({ ...m, isExtra: false })), outputs: extraOutputs.map((o) => ({ ...o, isExtra: false })) }
  }
  const next = deriveLines(bom, times, known)
  const taken = new Set([...extraMaterials, ...extraOutputs].map((l) => l.productId))
  const outputs = [
    ...next.outputs.filter((o) => !taken.has(o.productId)),
    ...extraOutputs.filter((o) => !next.materials.some((m) => m.productId === o.productId)),
  ]
  const sharesHold = outputs.every((o) => o.costShare !== null)
  return {
    materials: [...next.materials.filter((m) => !taken.has(m.productId)), ...extraMaterials.filter((m) => !next.outputs.some((o) => o.productId === m.productId))],
    outputs: sharesHold ? outputs : outputs.map((o) => ({ ...o, costShare: null })),
  }
}

export const savedMaterials = (items: any[] = []): MaterialLine[] =>
  items.map((item) => ({ productId: item.component_id, quantity: Number(item.quantity) || 0, consumption: item.is_fixed ? 'fixed' : 'variable', isExtra: Boolean(item.is_extra) }))

export const savedOutputs = (rows: any[] = []): OutputLine[] =>
  rows.map((row) => ({ productId: row.product_id, quantity: Number(row.quantity) || 0, costShare: shareOf(row.cost_share), isExtra: Boolean(row.is_extra) }))

/** A run saved before `batches` existed: how many batches its quantity was. */
export function initialBatches(initial: any, bom: ProductionBomOption | undefined): number {
  if (initial?.batches) return Number(initial.batches)
  if (bom) return round3((Number(initial?.quantity) || 0) / (Number(bom.output_quantity) || 1)) || 1
  return 1
}

export interface RunDraft {
  orderNumber: string
  bomId: string
  batches: number | ''
  orderDate: string
  notes: string
  assignedTo: string | null
  materials: MaterialLine[]
  outputs: OutputLine[]
}

/** The first thing wrong with a run, as a message key, or null. */
export function runProblem(draft: RunDraft): string | null {
  if (!draft.orderNumber.trim()) return 'common.required'
  if (draft.bomId && !(Number(draft.batches) > 0)) return 'common.required'
  return linesProblem(draft.materials, draft.outputs)
}

export function runPayload(draft: RunDraft, id?: string) {
  const shares = draft.outputs.every((o) => o.costShare !== null)
  return {
    id,
    order_number: draft.orderNumber.trim(),
    bom_id: draft.bomId || null,
    batches: draft.bomId ? Number(draft.batches) : null,
    product_id: draft.outputs[0].productId,
    quantity: draft.outputs[0].quantity,
    planned_date: draft.orderDate || null,
    notes: draft.notes.trim() || null,
    assigned_to: draft.assignedTo,
    items: draft.materials.map((m) => ({ component_id: m.productId, quantity: m.quantity, is_extra: m.isExtra, is_fixed: m.consumption === 'fixed' })),
    outputs: draft.outputs.map((o) => ({ product_id: o.productId, quantity: o.quantity, cost_share: shares ? o.costShare : null, is_extra: o.isExtra })),
  }
}
