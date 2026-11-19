const FOREIGN_KEY_VIOLATION = '23503'

export async function setRowActive(supabase: any, table: string, id: string, active: boolean) {
  const { error } = await supabase.from(table).update({ is_active: active }).eq('id', id)
  if (error) throw error
}

/** Deletes the row, or — when other records still point at it — switches it off instead. */
export async function deleteOrArchive(supabase: any, table: string, id: string): Promise<'deleted' | 'archived'> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (!error) return 'deleted'
  if (error.code !== FOREIGN_KEY_VIOLATION) throw error
  await setRowActive(supabase, table, id, false)
  return 'archived'
}
