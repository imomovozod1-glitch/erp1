'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal } from 'lucide-react'
import { AnalyticsClient } from '@/components/analytics/analytics-client'
import { PeriodFilter, presetRange } from '@/components/shared/period-filter'
import { ReportBuilder } from '@/components/reports/report-builder'
import { ReportSettingsDialog } from '@/components/reports/report-settings-dialog'
import { PageHeader } from '@/components/shared/page-header'
import {
  DEFAULT_METRICS, persistVisibleMetrics, readVisibleMetrics, type MetricId,
} from '@/lib/reports/metrics'
import {
  persistHiddenWidgets, readHiddenWidgets, type OverviewWidget,
} from '@/lib/reports/widgets'

/**
 * Two ways to read the same business: the fixed overview (charts and KPIs that
 * answer the usual questions) and the builder, for the question nobody
 * anticipated.
 *
 * This component owns the overview's *view* state — the period, the chosen
 * metrics, the visible blocks — rather than AnalyticsClient, so all of it can
 * be operated from a single header row shared with the page title. Keeping it
 * inside AnalyticsClient forced the controls into a band of their own below
 * the title and the tabs, three stacked rows before any figure appeared.
 */

const formatDateISO = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function ReportsTabs({
  today,
  lang,
  stats,
  recentOrders,
  lowStockRows,
}: {
  today: string
  lang: string
  stats: any
  recentOrders: any[]
  lowStockRows: any[]
}) {
  const t = useTranslations('reports')
  const tAnalytics = useTranslations('analytics')
  const tInfo = useTranslations('pageInfo')

  const [tab, setTab] = useState<'overview' | 'custom'>('overview')

  const [periodValue, setPeriodValue] = useState(() => ({
    period: 'all' as string,
    customStart: formatDateISO(new Date()) + 'T00:00',
    customEnd: formatDateISO(new Date()) + 'T23:59',
  }))

  // The presets this page offers, labelled from the analytics namespace where
  // "week"/"month" mean rolling 7/30-day windows — not the dashboard's
  // calendar week and month.
  const presets = (['today', 'yesterday', 'week', 'month', 'thisMonth', 'lastMonth', 'all'] as const)
    .map((value) => ({ value: value as string, label: tAnalytics(`presets.${value}`) }))

  const handlePeriodChange = (next: string) => {
    const range = presetRange(next)
    setPeriodValue((prev) => ({
      period: next,
      // "All time" ignores the range, so keep whatever the custom picker last
      // held rather than overwriting it.
      customStart: range?.start ?? prev.customStart,
      customEnd: range?.end ?? prev.customEnd,
    }))
  }

  const handleApplyCustomRange = (start: string, end: string) => {
    setPeriodValue({ period: 'custom', customStart: start, customEnd: end })
  }

  // Restore the last period after mount rather than in the initialiser: reading
  // sessionStorage during the first render makes the server and client markup
  // disagree. Deferred by a 0 ms timer so no state is set synchronously inside
  // the effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = sessionStorage.getItem('analytics_period')
      if (saved) setPeriodValue((prev) => ({ ...prev, period: saved }))
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    sessionStorage.setItem('analytics_period', periodValue.period)
  }, [periodValue.period])

  const [visibleMetrics, setVisibleMetrics] = useState<MetricId[]>(DEFAULT_METRICS)
  const [hiddenWidgets, setHiddenWidgets] = useState<OverviewWidget[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibleMetrics(readVisibleMetrics())
      setHiddenWidgets(readHiddenWidgets())
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const updateVisibleMetrics = (next: MetricId[]) => {
    setVisibleMetrics(next)
    persistVisibleMetrics(next)
  }
  const updateHiddenWidgets = (next: OverviewWidget[]) => {
    setHiddenWidgets(next)
    persistHiddenWidgets(next)
  }

  const periodLabel =
    periodValue.period === 'custom'
      ? tAnalytics('presets.custom')
      : tAnalytics(`presets.${periodValue.period}`)

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
      active
        ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
    }`

  return (
    <div>
      {/* Title, tabs and every filter control on one line. */}
      <PageHeader
        title={t('title')}
        info={tInfo('analytics')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
        ]}
      >
        {/* <div className="inline-flex items-center gap-1 rounded-lg border bg-slate-100 p-1 shadow-inner dark:bg-slate-800">
          <button type="button" onClick={() => setTab('overview')} className={tabClass(tab === 'overview')}>
            <BarChart3 className="h-3.5 w-3.5" />
            {t('overview')}
          </button>
          <button type="button" onClick={() => setTab('custom')} className={tabClass(tab === 'custom')}>
            <Table2 className="h-3.5 w-3.5" />
            {t('custom')}
          </button>
        </div> */}

        {/* The period and the view settings belong to the overview; the builder
            carries its own date range and column picker. */}
        {tab === 'overview' && (
          <>
            <PeriodFilter
              presets={presets}
              period={periodValue.period}
              onPeriodChange={handlePeriodChange}
              customStart={periodValue.customStart}
              customEnd={periodValue.customEnd}
              onApplyCustomRange={handleApplyCustomRange}
              lang={lang}
            />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-violet-400"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t('customizeView')}
            </button>
          </>
        )}
      </PageHeader>

      <ReportSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        metrics={visibleMetrics}
        onMetricsChange={updateVisibleMetrics}
        hiddenWidgets={hiddenWidgets}
        onWidgetsChange={updateHiddenWidgets}
      />

      {/* Both stay mounted so switching back doesn't re-run the overview's
          charts or throw away a report that was just built. */}
      <div className={tab === 'overview' ? '' : 'hidden'}>
        <AnalyticsClient
          lang={lang}
          stats={stats}
          recentOrders={recentOrders}
          lowStockRows={lowStockRows}
          period={periodValue.period}
          customStart={periodValue.customStart}
          customEnd={periodValue.customEnd}
          periodLabel={periodLabel}
          visibleMetrics={visibleMetrics}
          hiddenWidgets={hiddenWidgets}
        />
      </div>
      <div className={tab === 'custom' ? '' : 'hidden'}>
        <ReportBuilder today={today} />
      </div>
    </div>
  )
}
