import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { ShieldAlert, ShieldX, Lock, Activity } from 'lucide-react'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { PageHeader } from '@/components/shared/page-header'
import { PageClock } from '@/components/shared/page-clock'
import { StatsCard } from '@/components/shared/stats-card'
import { SecurityLogTable, type LoginAttemptRow } from '@/components/admin/security-log-table'
import { countCurrentlyLocked } from '@/lib/rate-limit'

export const metadata: Metadata = { title: 'Security' }
export const dynamic = 'force-dynamic'

const RECENT_LIMIT = 500

export default async function AdminSecurityPage() {
  const [t, lang] = await Promise.all([getTranslations('admin.security'), getLocale()])

  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('login_attempts')
    .select('id, identifier, ip, success, created_at')
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT)

  const attempts: LoginAttemptRow[] = data ?? []

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const failedToday = attempts.filter((a) => !a.success && new Date(a.created_at) >= dayStart).length
  const totalToday = attempts.filter((a) => new Date(a.created_at) >= dayStart).length

  const currentlyLocked = countCurrentlyLocked(attempts)

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')}>
        <PageClock lang={lang} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t('statTotalToday')} value={totalToday} icon={Activity} iconClassName="bg-indigo-500" />
        <StatsCard title={t('statFailedToday')} value={failedToday} icon={ShieldX} iconClassName="bg-rose-500" />
        <StatsCard title={t('statLocked')} value={currentlyLocked} icon={Lock} iconClassName="bg-amber-500" />
        <StatsCard title={t('statTracked')} value={attempts.length} icon={ShieldAlert} iconClassName="bg-slate-500" />
      </div>

      <SecurityLogTable attempts={attempts} />
    </div>
  )
}
