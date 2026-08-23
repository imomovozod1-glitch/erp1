import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AdminResetPasswordForm } from '@/components/admin/admin-reset-password-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.accountRecovery')
  return { title: t('newPasswordTitle') }
}

export default function AdminResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AdminResetPasswordForm />
      </div>
    </div>
  )
}
