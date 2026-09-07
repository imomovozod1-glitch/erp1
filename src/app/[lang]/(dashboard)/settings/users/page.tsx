import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { UsersList } from '@/components/settings/users-list'
import { requireModuleView } from '@/lib/permissions-server'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'settings' })
  return { title: t('users') }
}

export default async function UsersSettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Settings is a permissioned module; profile/ and security/ deliberately
  // stay open so a user can always read their own details and change their
  // own password.
  await requireModuleView('settings', lang)
  const user = await getSessionUser()

  if (!user) {
    redirect(`/${lang}/login`)
  }

  const currentUserProfile = await getCachedProfile(user.id)
  const t = await getTranslations('settings')

  // Fetch all profiles
  const supabase = await createClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('users')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/settings` },
          { label: t('users') },
        ]}
      />
      <UsersList
        profiles={profiles || []}
        currentUserProfile={currentUserProfile}
        lang={lang}
      />
    </div>
  )
}
