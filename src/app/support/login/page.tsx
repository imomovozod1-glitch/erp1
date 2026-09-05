import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSupportAgentSession } from '@/lib/admin-auth'
import { SupportLoginForm } from '@/components/support-portal/support-login-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('supportPortal')
  return { title: t('loginHeading') }
}

export default async function SupportLoginPage() {
  const session = await getSupportAgentSession()
  if (session) redirect('/support')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SupportLoginForm />
      </div>
    </div>
  )
}
