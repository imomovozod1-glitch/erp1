export async function nameTaken(supabase: any, name: string, exceptId?: string) {
  let query = supabase.from('products').select('id').ilike('name', name.trim())
  if (exceptId) query = query.neq('id', exceptId)
  const { data, error } = await query
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function currentUserId(supabase: any): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

// supabase-js turns an `undefined` key into an explicit null, which breaks the
// NOT NULL columns' own defaults — so blank optional fields are left out entirely.
const withoutUndefined = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined))

export function catalogPayload(data: Record<string, unknown>, initial: any, userId: string | null, extra: Record<string, unknown> = {}) {
  return withoutUndefined({
    assigned_to: initial?.assigned_to ?? userId,
    created_by: initial?.created_by ?? userId,
    ...extra,
    ...data,
    category_id: data.category_id || null,
  })
}

export async function writeCatalogRow(supabase: any, payload: Record<string, unknown>, id?: string) {
  const query = id ? supabase.from('products').update(payload).eq('id', id) : supabase.from('products').insert([payload]).select()
  const { data, error } = await query
  if (error) throw error
  return (data?.[0] ?? null) as { id: string } | null
}
