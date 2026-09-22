import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
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

  const { data: removed, error } = await supabase.from('super_admins').delete().eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  // Only delete the auth user when the id really was a super-admin — without
  // this, any auth user id (a tenant user, a support agent) would be deleted.
  if (!removed?.length) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })

  await supabase.auth.admin.deleteUser(id)
  revalidateTag(`staff-identity:${id}`, { expire: 0 })

  return NextResponse.json({ success: true })
}
