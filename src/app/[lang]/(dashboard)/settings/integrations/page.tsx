import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { PageHeader } from '@/components/shared/page-header'
import { TelegramIntegrationForm } from '@/components/settings/telegram-integration-form'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'settings' })
  return { title: t('integrationsTitle') }
}

export default async function IntegrationsSettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const user = await getSessionUser()

  if (!user) {
    redirect(`/${lang}/login`)
  }

  // Connecting a bot means handing the ERP a credential that can post as the
  // company — admin-only, matching the API routes behind this page (which
  // enforce the same check server-side; this is just so a non-admin doesn't
  // land on a page whose every request would 403).
  const profile = (await getCachedProfile(user.id)) as { role?: string } | null
  if (profile?.role !== 'admin') {
    redirect(`/${lang}/settings`)
  }

  const t = await getTranslations('settings')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('integrationsTitle')}
        subtitle={t('integrationsCardDesc')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/settings` },
          { label: t('integrationsTitle') },
        ]}
      />
      <TelegramIntegrationForm />
    </div>
  )
}
