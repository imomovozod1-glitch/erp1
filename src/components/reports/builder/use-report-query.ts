'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { DATED_SOURCES, SOURCE_GROUPINGS, type ReportGrouping, type ReportResult, type ReportSource } from '@/lib/reports/definitions'
import { isoDate } from '@/lib/utils'
import type { ReportQuery } from './saved-reports'

const DEFAULT_SPAN_DAYS = 29

function isoDaysAgo(days: number, today: string) {
  const date = new Date(`${today}T00:00:00`)
  date.setDate(date.getDate() - days)
  return isoDate(date)
}

const requestBody = (query: ReportQuery) => ({
  source: query.source,
  groupBy: query.groupBy,
  search: query.search.trim() || undefined,
  ...(DATED_SOURCES.includes(query.source) ? { from: query.from, to: query.to } : {}),
})

/** What to ask the server for, and its answer. The query runs server-side to respect permission and data scope. */
export function useReportQuery(today: string) {
  const t = useTranslations()
  const [query, setQuery] = useState<ReportQuery>(() => ({ source: 'sales', groupBy: 'day', from: isoDaysAgo(DEFAULT_SPAN_DAYS, today), to: today, search: '' }))
  const [result, setResult] = useState<ReportResult | null>(null)
  const [running, setRunning] = useState(false)

  const update = (patch: Partial<ReportQuery>) => setQuery((current) => ({ ...current, ...patch }))

  // Each source offers its own groupings; the current one is kept only when it still exists.
  const changeSource = (source: ReportSource) => {
    const groupings = SOURCE_GROUPINGS[source]
    setQuery((current) => ({ ...current, source, groupBy: groupings.includes(current.groupBy) ? current.groupBy : (groupings[0] as ReportGrouping) }))
    setResult(null)
  }

  const fail = (body: any) => toast.error(body?.error === 'forbidden' ? t('reports.errorForbidden') : errorMessage(t, body, t('common.error')))

  const run = async (override?: ReportQuery) => {
    if (running) return
    setRunning(true)
    try {
      const res = await fetch('/api/reports/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody(override ?? query)) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return fail(json)
      setResult(json as ReportResult)
      if (json.truncated) toast.warning(t('reports.truncated'))
    } catch (error) {
      fail(error)
    } finally {
      setRunning(false)
    }
  }

  const load = (saved: ReportQuery) => {
    const next = { source: saved.source, groupBy: saved.groupBy, from: saved.from, to: saved.to, search: saved.search }
    setQuery(next)
    void run(next)
  }

  return { query, update, changeSource, result, running, run: () => run(), load, isDated: DATED_SOURCES.includes(query.source) }
}

export type ReportQueryState = ReturnType<typeof useReportQuery>
