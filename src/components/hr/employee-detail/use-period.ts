'use client'

import { useState } from 'react'
import { isoDate } from '@/lib/utils'

export const PERIOD_PRESETS = ['all', 'today', 'week', 'month'] as const
export type Period = (typeof PERIOD_PRESETS)[number] | 'custom'

const DAY_MS = 24 * 60 * 60 * 1000
const PRESET_DAYS = { week: 7, month: 30 } as const

/** A period picked in the page header, applied in memory to the rows the server already sent. */
export function usePeriod() {
  const [now] = useState(() => new Date())
  const [period, setPeriod] = useState<Period>('all')
  const [range, setRange] = useState({ start: '', end: '' })

  const applyRange = (start: string, end: string) => {
    setRange({ start, end })
    setPeriod('custom')
  }

  const reset = () => {
    setPeriod('all')
    setRange({ start: '', end: '' })
  }

  const within = (value?: string | null) => {
    if (!value) return false
    if (period === 'all') return true
    if (period === 'today') return value.split('T')[0] === isoDate(now)
    const date = new Date(value)
    if (period === 'custom') return (!range.start || date >= new Date(range.start)) && (!range.end || date <= new Date(range.end))
    return date.getTime() >= now.getTime() - PRESET_DAYS[period] * DAY_MS
  }

  return { now, period, setPeriod, range, applyRange, reset, within }
}

export type PeriodState = ReturnType<typeof usePeriod>
