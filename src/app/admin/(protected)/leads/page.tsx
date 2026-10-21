import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Inbox, PhoneCall, CircleCheck, ListChecks } from 'lucide-react'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { LeadsTable, type LeadRow } from '@/components/admin/leads-table'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.leads')
  return { title: t('title') }
}
export const dynamic = 'force-dynamic'

const RECENT_LIMIT = 500

export default async function AdminLeadsPage() {
  const t = await getTranslations('admin.leads')

  const supabase = getCacheClient() as any
  const { data } = await supabase
    .from('leads')
    .select('id, name, company, phone, comment, lang, status, created_at')
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT)

  const leads: LeadRow[] = data ?? []
  const count = (status: LeadRow['status']) => leads.filter((l) => l.status === status).length

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t('statNew')} value={count('new')} icon={Inbox} iconClassName="bg-violet-500" />
        <StatsCard title={t('statContacted')} value={count('contacted')} icon={PhoneCall} iconClassName="bg-amber-500" />
        <StatsCard title={t('statClosed')} value={count('closed')} icon={CircleCheck} iconClassName="bg-emerald-500" />
        <StatsCard title={t('statTotal')} value={leads.length} icon={ListChecks} iconClassName="bg-slate-500" />
      </div>

      <LeadsTable leads={leads} />
    </div>
  )
}
