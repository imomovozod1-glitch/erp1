import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { adminServerError } from '@/lib/admin-errors-server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params

  if (id === session.userId) {
    return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 })
  }

  const supabase = getCacheClient() as any

  const { count } = await supabase.from('super_admins').select('id', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'cannot_remove_last_admin' }, { status: 400 })
  }

  const { data: removed, error } = await supabase.from('super_admins').delete().eq('id', id).select('id')
  if (error) return adminServerError(error)
  // Only delete the auth user when the id really was a super-admin — without
  // this, any auth user id (a tenant user, a support agent) would be deleted.
  if (!removed?.length) return NextResponse.json({ error: 'admin_not_found' }, { status: 404 })

  await supabase.auth.admin.deleteUser(id)
  revalidateTag(`staff-identity:${id}`, { expire: 0 })

  return NextResponse.json({ success: true })
}
