'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BarChart3, Table2 } from 'lucide-react'
import { ReportBuilder } from '@/components/reports/report-builder'

/**
 * Two ways to read the same business: the fixed overview (charts and KPIs that
 * answer the usual questions) and the builder, for the question nobody
 * anticipated. The overview is rendered on the server and passed in as a slot
 * so its heavy cached queries don't move into the client bundle.
 */
export function ReportsTabs({
  overview,
  today,
}: {
  overview: React.ReactNode
  today: string
}) {
  const t = useTranslations('reports')
  const [tab, setTab] = useState<'overview' | 'custom'>('overview')

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
      active
        ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
    }`

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border shadow-inner">
        <button type="button" onClick={() => setTab('overview')} className={tabClass(tab === 'overview')}>
          <BarChart3 className="h-3.5 w-3.5" />
          {t('overview')}
        </button>
        <button type="button" onClick={() => setTab('custom')} className={tabClass(tab === 'custom')}>
          <Table2 className="h-3.5 w-3.5" />
          {t('custom')}
        </button>
      </div>

      {/* Both stay mounted so switching back doesn't re-run the overview's
          charts or throw away a report that was just built. */}
      <div className={tab === 'overview' ? '' : 'hidden'}>{overview}</div>
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <ReportBuilder today={today} />
      </div>
    </div>
  )
}
