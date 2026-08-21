import { redirect } from 'next/navigation'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSuperAdminSession()
  if (!session) redirect('/admin/login')

  return (
    <AdminShell adminName={session.fullName} adminEmail={session.email}>
      {children}
    </AdminShell>
  )
}
