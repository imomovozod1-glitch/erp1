import type { DateRange } from './types'

/** `YYYY-MM-DD` for a Date, in local time — never `toISOString()`, which shifts the day across the UTC boundary. */
export function isoDay(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Parses the `YYYY-MM-DDTHH:mm` strings the period filter produces. */
export function parseBound(value: string, endOfDay: boolean): Date | null {
  if (!value) return null
  const withTime = value.includes('T') ? value : `${value}T${endOfDay ? '23:59' : '00:00'}`
  const d = new Date(withTime)
  return Number.isNaN(d.getTime()) ? null : d
}

/** True when `dateish` (a date column, with or without a time part) lies inside the range. */
export function inRange(dateish: string | null | undefined, range: DateRange): boolean {
  if (!range.start && !range.end) return true
  if (!dateish) return false
  const d = new Date(dateish.includes('T') ? dateish : `${dateish}T12:00`)
  if (Number.isNaN(d.getTime())) return false
  if (range.start && d < range.start) return false
  if (range.end && d > range.end) return false
  return true
}

/**
 * The range a preset stands for, relative to an explicitly supplied "today".
 *
 * `presetRange()` in period-filter.tsx does the same job but reads the system
 * clock itself, which makes it an impure call — illegal during render under
 * the React Compiler lint rules this project enforces (see AGENTS.md). Report
 * pages therefore take today's date as a prop from the server and resolve
 * their ranges through this instead.
 *
 * Returns null for presets with no bounds ("all"), which callers read as
 * "don't filter".
 */
export function presetRangeFrom(preset: string, today: Date): DateRange | null {
  const dayStart = (d: Date) => {
    const copy = new Date(d)
    copy.setHours(0, 0, 0, 0)
    return copy
  }
  const dayEnd = (d: Date) => {
    const copy = new Date(d)
    copy.setHours(23, 59, 59, 999)
    return copy
  }
  const shiftDays = (d: Date, days: number) => {
    const copy = new Date(d)
    copy.setDate(copy.getDate() + days)
    return copy
  }

  switch (preset) {
    case 'today':
      return { start: dayStart(today), end: dayEnd(today) }
    case 'yesterday': {
      const yesterday = shiftDays(today, -1)
      return { start: dayStart(yesterday), end: dayEnd(yesterday) }
    }
    // Rolling windows, matching the "last 7 / 30 days" labels.
    case 'week':
      return { start: dayStart(shiftDays(today, -6)), end: dayEnd(today) }
    case 'month':
      return { start: dayStart(shiftDays(today, -29)), end: dayEnd(today) }
    case 'thisMonth': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: dayStart(first), end: dayEnd(today) }
    }
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: dayStart(first), end: dayEnd(last) }
    }
    default:
      return null
  }
}
