'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/shared/page-header'
import { PeriodFilter } from '@/components/shared/period-filter'
import { parseBound, presetRangeFrom, type DateRange } from '@/lib/reports/sales-analytics'

/** The presets every sales report offers, in one place so five screens can't drift apart. */
const PRESETS = ['today', 'yesterday', 'week', 'month', 'thisMonth', 'lastMonth', 'all'] as const

/** Opens on the last 30 days: long enough for a daily chart to show a shape, short enough to still be about *now*. */
const DEFAULT_PERIOD = 'month'

export interface ReportPeriod {
  range: DateRange
  periodLabel: string
  /** `all` means "no bounds" — reports that phrase things differently when unbounded read this. */
  period: string
}

/** `YYYY-MM-DDTHH:mm`, the shape the custom-range picker exchanges. */
function toPickerValue(d: Date | null, endOfDay: boolean): string {
  if (!d) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T${endOfDay ? '23:59' : '00:00'}`
}

/**
 * The frame every sales report page shares: title row, back button, period
 * filter, and the resolved date range handed down to the report body.
 *
 * A render prop rather than plain children because the range is state owned
 * here — putting the filter in each page instead meant five copies of the same
 * preset list, the same sessionStorage handling and the same string-to-Date
 * parsing, and copies of a date rule drift.
 *
 * `today` arrives as a prop from the server rather than being read off the
 * clock here: `new Date()` during render is an impure call and a lint error
 * under this project's React Compiler rules (AGENTS.md).
 */
export function ReportLayout({
  lang,
  today,
  title,
  info,
  storageKey,
  actions,
  children,
}: {
  lang: string
  /** `YYYY-MM-DD`, stamped on the server. */
  today: string
  title: string
  info?: string
  /** sessionStorage key so each report remembers its own last period. */
  storageKey: string
  actions?: ReactNode
  children: (period: ReportPeriod) => ReactNode
}) {
  const t = useTranslations('reports')
  const tAnalytics = useTranslations('analytics')

  const todayDate = new Date(`${today}T12:00`)

  const [state, setState] = useState(() => {
    const initial = presetRangeFrom(DEFAULT_PERIOD, todayDate)
    return {
      period: DEFAULT_PERIOD as string,
      start: initial?.start ?? null,
      end: initial?.end ?? null,
    }
  })

  // Restored after mount, not in the initialiser: reading sessionStorage during
  // the first render makes the server and client markup disagree. Deferred by a
  // 0 ms timer so no state is set synchronously inside the effect
  // (react-hooks/set-state-in-effect — see AGENTS.md).
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = sessionStorage.getItem(storageKey)
      // A saved "custom" has no bounds stored with it, so it can't be restored
      // meaningfully — those sessions just reopen on the default window.
      if (!saved || saved === 'custom') return
      const restored = presetRangeFrom(saved, new Date(`${today}T12:00`))
      setState({ period: saved, start: restored?.start ?? null, end: restored?.end ?? null })
    }, 0)
    return () => clearTimeout(timer)
  }, [storageKey, today])

  const handlePeriodChange = (next: string) => {
    const preset = presetRangeFrom(next, todayDate)
    sessionStorage.setItem(storageKey, next)
    setState({ period: next, start: preset?.start ?? null, end: preset?.end ?? null })
  }

  const handleApplyCustomRange = (start: string, end: string) => {
    sessionStorage.setItem(storageKey, 'custom')
    setState({ period: 'custom', start: parseBound(start, false), end: parseBound(end, true) })
  }

  const range: DateRange = { start: state.start, end: state.end }
  const periodLabel =
    state.period === 'custom' ? tAnalytics('presets.custom') : tAnalytics(`presets.${state.period}`)

  return (
    <div>
      <PageHeader
        title={title}
        info={info}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title'), href: `/${lang}/reports` },
          { label: title },
        ]}
      >
        <PeriodFilter
          presets={PRESETS.map((value) => ({
            value: value as string,
            label: tAnalytics(`presets.${value}`),
          }))}
          period={state.period}
          onPeriodChange={handlePeriodChange}
          customStart={toPickerValue(state.start, false)}
          customEnd={toPickerValue(state.end, true)}
          onApplyCustomRange={handleApplyCustomRange}
          lang={lang}
        />
        {actions}
      </PageHeader>

      <div className="space-y-6">{children({ range, periodLabel, period: state.period })}</div>
    </div>
  )
}
