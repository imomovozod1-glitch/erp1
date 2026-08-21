import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { SettingsTabs } from '@/components/admin/settings-tabs'
import { SuperAdminsTable, type SuperAdminRow } from '@/components/admin/super-admins-table'

export const metadata: Metadata = { title: 'Admins' }
export const dynamic = 'force-dynamic'

export default async function AdminSettingsAdminsPage() {
  const session = await getSuperAdminSession()
  if (!session) redirect('/admin/login')

  const [t, lang] = await Promise.all([getTranslations('admin.settings'), getLocale()])

  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('super_admins')
    .select('id, full_name, email, created_at')
    .order('created_at', { ascending: true })

  const admins: SuperAdminRow[] = data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')}>
        <PageClock lang={lang} />
      </PageHeader>

      <SettingsTabs />

      <SuperAdminsTable admins={admins} currentAdminId={session.userId} />
    </div>
  )
}
