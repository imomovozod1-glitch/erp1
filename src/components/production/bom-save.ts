import type { MaterialLine, OutputLine } from './lines/lines-model'

/** Codes a database without migration_production_outputs.sql answers with. */
export const MISSING_SCHEMA_CODES = new Set(['PGRST204', 'PGRST205', '42P01', '42703'])

export interface BomDraft {
  name: string
  notes?: string
  is_active: boolean
  assignedTo: string | null
  materials: MaterialLine[]
  outputs: OutputLine[]
}

export const savedBomMaterials = (items: any[] = []): MaterialLine[] =>
  items.map((item) => ({ productId: item.component_id, quantity: Number(item.quantity) || 0, consumption: item.consumption === 'fixed' ? 'fixed' : 'variable', isExtra: false }))

export function savedBomOutputs(rows: any[] | undefined, initial: any, presetProductId?: string): OutputLine[] {
  if (rows?.length) {
    return rows.map((row) => ({
      productId: row.product_id,
      quantity: Number(row.quantity) || 0,
      costShare: row.cost_share === null || row.cost_share === undefined ? null : Number(row.cost_share),
      isExtra: false,
    }))
  }
  const productId = initial?.product_id ?? presetProductId
  return productId ? [{ productId, quantity: Number(initial?.output_quantity) || 1, costShare: null, isExtra: false }] : []
}

const throwIf = (...results: { error: unknown }[]) => {
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

// The header mirrors the first output (`product_id` / `output_quantity`) for readers that predate product_bom_outputs.
async function writeHeader(supabase: any, draft: BomDraft, initial: any, userId: string | null): Promise<string> {
  const payload = {
    name: draft.name.trim(),
    product_id: draft.outputs[0].productId,
    output_quantity: draft.outputs[0].quantity,
    notes: draft.notes || null,
    is_active: draft.is_active,
    assigned_to: draft.assignedTo ?? initial?.assigned_to ?? userId,
    created_by: initial?.created_by ?? userId,
  }
  if (!initial?.id) {
    const { data, error } = await supabase.from('product_boms').insert([payload]).select('id').single()
    if (error) throw error
    return data.id
  }
  throwIf(await supabase.from('product_boms').update(payload).eq('id', initial.id))
  throwIf(...(await Promise.all([supabase.from('product_bom_items').delete().eq('bom_id', initial.id), supabase.from('product_bom_outputs').delete().eq('bom_id', initial.id)])))
  return initial.id
}

/** No stock or money moves, so this is a plain browser write: the header, then both line lists replaced. */
export async function saveBom(supabase: any, draft: BomDraft, initial: any) {
  const { data: auth } = await supabase.auth.getUser()
  const bomId = await writeHeader(supabase, draft, initial, auth?.user?.id ?? null)
  const shares = draft.outputs.every((o) => o.costShare !== null)
  throwIf(
    ...(await Promise.all([
      supabase.from('product_bom_items').insert(draft.materials.map((m) => ({ bom_id: bomId, component_id: m.productId, quantity: m.quantity, consumption: m.consumption }))),
      supabase.from('product_bom_outputs').insert(draft.outputs.map((o) => ({ bom_id: bomId, product_id: o.productId, quantity: o.quantity, cost_share: shares ? o.costShare : null }))),
    ]))
  )
}
