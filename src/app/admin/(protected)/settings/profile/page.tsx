import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { SettingsTabs } from '@/components/admin/settings-tabs'
import { AdminProfileForm } from '@/components/admin/admin-profile-form'
import { AdminSecurityForm } from '@/components/admin/admin-security-form'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

export default async function AdminSettingsProfilePage() {
  const session = await getSuperAdminSession()
  if (!session) redirect('/admin/login')

  const [t, lang] = await Promise.all([getTranslations('admin.settings'), getLocale()])

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')}>
        <PageClock lang={lang} />
      </PageHeader>

      <SettingsTabs />

      <div className="space-y-6">
        <AdminProfileForm fullName={session.fullName} email={session.email} />
        <AdminSecurityForm />
      </div>
    </div>
  )
}
