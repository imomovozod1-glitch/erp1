/**
 * Subscription arithmetic — one implementation, used by the console, the API
 * and the gate.
 *
 * There were two before, both `new Date(x).setMonth(m + n)`, and both wrong in
 * the same two ways. JavaScript's setMonth does not clamp: 31 January plus one
 * month is 31 February, which it rolls forward to 3 March. A company billed
 * monthly from a month end therefore gained days on every single payment, and
 * the date drifted permanently — 31 Jan → 3 Mar → 3 Apr. And `new Date('2026-01-31')`
 * is parsed as UTC midnight while setMonth and the local date readback are not,
 * so the same call could answer with two different days depending on where it
 * ran (the browser in Tashkent, the server in UTC).
 *
 * Everything here is plain calendar arithmetic on `YYYY-MM-DD` strings: no Date
 * parsing, no time zone, no drift. The end of the month clamps the way every
 * billing system clamps it — 31 Jan + 1 month = 28 Feb (29 in a leap year) —
 * and 28 Feb + 1 month stays 28 March rather than snapping to the month end.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Days in a month, 1-indexed month. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function parse(dateStr: string): { year: number; month: number; day: number } | null {
  const match = DATE_PATTERN.exec(dateStr?.slice(0, 10) ?? '')
  if (!match) return null
  const [, year, month, day] = match
  return { year: Number(year), month: Number(month), day: Number(day) }
}

/**
 * `dateStr` plus whole calendar months, clamped to the target month's last day.
 * Returns the input unchanged if it is not a `YYYY-MM-DD` date.
 */
export function addMonths(dateStr: string, months: number): string {
  const parsed = parse(dateStr)
  if (!parsed) return dateStr

  const count = Math.trunc(Number(months) || 0)
  // Months counted from zero so the arithmetic carries into years by itself.
  const total = (parsed.year * 12 + (parsed.month - 1)) + count
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const day = Math.min(parsed.day, daysInMonth(year, month))

  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * Whole days from `from` (today by default) to `endsAt`, by the calendar.
 *
 * Counted as a difference of dates rather than of timestamps: what matters is
 * how many more days the company may work, and a subscription ending tomorrow
 * has one day left whether it is read at 09:00 or at 23:00. `null` when there
 * is no end date to count to.
 */
export function daysUntil(endsAt: string | null | undefined, from?: string): number | null {
  const end = parse(endsAt ?? '')
  const start = parse(from ?? todayIso())
  if (!end || !start) return null
  const endUtc = Date.UTC(end.year, end.month - 1, end.day)
  const startUtc = Date.UTC(start.year, start.month - 1, start.day)
  return Math.round((endUtc - startUtc) / 86_400_000)
}

/**
 * Today as `YYYY-MM-DD` in the runtime's own zone — the same rule as isoDate()
 * in src/lib/utils.ts, repeated here so this module stays free of imports and
 * can be used in the Edge middleware.
 */
export function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Whether a subscription has run out.
 *
 * The stored end date is INCLUSIVE: a company whose subscription "ends
 * 22 September" works all through the 22nd and is refused on the 23rd. The
 * previous rule compared `new Date(ends_at)` — UTC midnight — against the
 * clock, which locked the company out at the start of the very day they had
 * paid for.
 */
export function isSubscriptionExpired(endsAt: string | null | undefined, today?: string): boolean {
  const days = daysUntil(endsAt, today)
  return days !== null && days < 0
}

/** Days left before the company is warned that its subscription is ending. */
export const SUBSCRIPTION_WARNING_DAYS = 7
