import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSupportAgentSession } from '@/lib/admin-auth'
import { SupportLoginForm } from '@/components/support-portal/support-login-form'
import { AuthScreen } from '@/components/auth/auth-card'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('supportPortal')
  return { title: t('loginHeading') }
}

export default async function SupportLoginPage() {
  const session = await getSupportAgentSession()
  if (session) redirect('/support')

  return (
    <AuthScreen>
      <SupportLoginForm />
    </AuthScreen>
  )
}
