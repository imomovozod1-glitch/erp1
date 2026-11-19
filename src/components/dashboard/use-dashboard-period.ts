'use client'

import { useEffect, useState } from 'react'
import { isoDate } from '@/lib/utils'
import { DASHBOARD_PERIODS, type DashboardPeriod, type PeriodChoice } from './dashboard-metrics'

const KEYS = { period: 'dashboard_period', start: 'dashboard_custom_start', end: 'dashboard_custom_end' } as const

function readSaved(fallback: PeriodChoice): PeriodChoice {
  try {
    const period = sessionStorage.getItem(KEYS.period) as DashboardPeriod | null
    return {
      period: period && DASHBOARD_PERIODS.includes(period) ? period : fallback.period,
      start: sessionStorage.getItem(KEYS.start) || fallback.start,
      end: sessionStorage.getItem(KEYS.end) || fallback.end,
    }
  } catch {
    return fallback
  }
}

/** The dashboard's period, remembered for the tab; restored after mount so the server render stays the default. */
export function useDashboardPeriod() {
  const [now] = useState(() => new Date())
  const [choice, setChoice] = useState<PeriodChoice>(() => ({ period: 'all', start: `${isoDate(now)}T00:00`, end: `${isoDate(now)}T23:59` }))
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setChoice((current) => readSaved(current))
      setRestored(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!restored) return
    try {
      sessionStorage.setItem(KEYS.period, choice.period)
      sessionStorage.setItem(KEYS.start, choice.start)
      sessionStorage.setItem(KEYS.end, choice.end)
    } catch {}
  }, [choice, restored])

  return {
    now,
    choice,
    setPeriod: (period: DashboardPeriod) => setChoice((current) => ({ ...current, period })),
    applyRange: (start: string, end: string) => setChoice({ period: 'custom', start, end }),
  }
}
