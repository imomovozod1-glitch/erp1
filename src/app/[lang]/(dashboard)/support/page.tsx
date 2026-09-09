import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { getCurrentTenantId } from '@/lib/tenant'
import { SupportClient } from '@/components/support/support-client'
import { AssignedAgentCard } from '@/components/support/assigned-agent-card'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'support' })
  return { title: t('title') }
}

export default async function SupportPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const user = await getSessionUser()

  if (!user) {
    redirect(`/${lang}/login`)
  }

  const [profile, tenantId] = await Promise.all([
    getCachedProfile(user.id),
    getCurrentTenantId(),
  ])
  if (!profile) {
    redirect(`/${lang}/login`)
  }

  // The tenant's realtime inbox topic, so a support reply appears immediately
  // rather than on the next poll.
  return (
    <SupportClient
      lang={lang}
      tenantId={tenantId}
      agentCard={<AssignedAgentCard tenantId={tenantId} lang={lang} />}
    />
  )
}
