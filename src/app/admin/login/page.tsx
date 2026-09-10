import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { AdminLoginForm } from '@/components/admin/admin-login-form'
import { AuthScreen } from '@/components/auth/auth-card'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.login')
  return { title: t('heading') }
}

export default async function AdminLoginPage() {
  const session = await getSuperAdminSession()
  if (session) redirect('/admin/tenants')

  return (
    <AuthScreen>
      <AdminLoginForm />
    </AuthScreen>
  )
}
