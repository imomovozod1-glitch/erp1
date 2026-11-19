/** Reads the caller's role and permissions, for deciding which actions to offer. */
export async function readCallerAccess(supabase: any) {
  const { data: { session } } = await supabase.auth.getSession()
  const userId: string | undefined = session?.user?.id
  const { data: profile } = await supabase.from('profiles').select('role, permissions').eq('id', userId ?? '').maybeSingle()
  return { userId, role: profile?.role, permissions: profile?.permissions }
}
