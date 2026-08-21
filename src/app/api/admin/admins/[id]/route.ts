import { NextRequest, NextResponse } from 'next/server'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (id === session.userId) {
    return NextResponse.json({ error: 'You cannot remove your own admin account' }, { status: 400 })
  }

  const supabase = getCacheClient() as any

  const { count } = await supabase.from('super_admins').select('id', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Cannot remove the last remaining super admin' }, { status: 400 })
  }

  const { error } = await supabase.from('super_admins').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.auth.admin.deleteUser(id)

  return NextResponse.json({ success: true })
}
