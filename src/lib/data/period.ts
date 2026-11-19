import { isoDate } from '@/lib/utils'

/**
 * Resolves a period key from the URL into an inclusive [from, to) ISO range.
 *
 * The transactions page used to hold the period in component state and filter
 * the full transaction list in the browser. With the list paginated in
 * Postgres the range has to be resolved server-side, so the filter moves into
 * the URL alongside page and search.
 */
export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'

/**
 * The same presets as `resolvePeriodRange`, but as `YYYY-MM-DD` bounds for a
 * DATE column rather than ISO timestamps for a `timestamptz` one.
 *
 * `transactions.transaction_date` is the day the money moved, which is not
 * always the day the row was written — a transaction back-dated to last week is
 * filed under last week, and comparing it against `created_at` bounds would
 * file it under today. Local dates, never `toISOString()`: see `isoDate`.
 */
export function resolvePeriodDays(
  period: PeriodKey,
  customStart?: string,
  customEnd?: string
): { from?: string; to?: string } {
  const now = new Date()
  const shifted = (days: number) => isoDate(new Date(now.getTime() + days * 86_400_000))

  switch (period) {
    case 'today':
      return { from: isoDate(now), to: isoDate(now) }
    case 'yesterday':
      return { from: shifted(-1), to: shifted(-1) }
    // Rolling windows, matching the "Oxirgi 7/30 kun" labels — open-ended at
    // the top so a transaction dated tomorrow (a scheduled payment) still shows.
    case 'week':
      return { from: shifted(-7) }
    case 'month':
      return { from: shifted(-30) }
    case 'custom':
      return {
        // The pickers hand over "YYYY-MM-DDTHH:mm"; only the day part matters here.
        from: customStart ? customStart.slice(0, 10) : undefined,
        to: customEnd ? customEnd.slice(0, 10) : undefined,
      }
    default:
      return {}
  }
}

export function resolvePeriodRange(
  period: PeriodKey,
  customStart?: string,
  customEnd?: string
): { from?: string; to?: string } {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString()

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const y = new Date(now.getTime() - 86_400_000)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case 'week':
      return { from: new Date(now.getTime() - 7 * 86_400_000).toISOString() }
    case 'month':
      return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString() }
    case 'custom':
      return {
        from: customStart ? new Date(customStart).toISOString() : undefined,
        to: customEnd ? new Date(customEnd).toISOString() : undefined,
      }
    default:
      return {}
  }
}
