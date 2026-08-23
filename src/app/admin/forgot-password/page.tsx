import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { AdminForgotPasswordForm } from '@/components/admin/admin-forgot-password-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.accountRecovery')
  return { title: t('forgotTitle') }
}

export default async function AdminForgotPasswordPage() {
  const session = await getSuperAdminSession()
  if (session) redirect('/admin/tenants')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AdminForgotPasswordForm />
      </div>
    </div>
  )
}
