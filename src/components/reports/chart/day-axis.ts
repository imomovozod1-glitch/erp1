import type { DayPoint } from '@/lib/reports/sales-analytics'

const MONTHS_SHORT: Record<string, string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

/** Indexed by `Date.getDay()`, so Sunday first. */
const WEEKDAYS_SHORT: Record<string, string[]> = {
  uz: ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

function pickLocale(table: Record<string, string[]>, lang: string): string[] {
  return table[lang] ?? table.en
}

/** Midday, so a timezone west of UTC can't pull the date back a day. */
export function parseDay(day: string): Date | null {
  const d = new Date(`${day}T12:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export type Granularity = 'weekday' | 'day' | 'month'

/**
 * Takes the day list, not just its length: month labels are only meaningful on
 * a CONTIGUOUS series. The "all time" fallback hands over just the days that
 * had sales, and labelling a gap-ridden series by month would print "sen" over
 * a point that is the 16th — so a sparse series stays on day labels however
 * long it is.
 */
function granularityFor(days: string[]): Granularity {
  if (days.length <= 14) return 'weekday'
  if (days.length <= 62) return 'day'
  const span =
    Math.round(
      (new Date(`${days[days.length - 1]}T12:00`).getTime() -
        new Date(`${days[0]}T12:00`).getTime()) / 86_400_000
    ) + 1
  return span === days.length ? 'month' : 'day'
}

/**
 * Which days get a printed label.
 *
 * Chosen explicitly rather than left to recharts' `interval`/`minTickGap`,
 * which thins ticks by pixel width at render time: the last day — the one the
 * reader looks for first — was the one it kept dropping.
 */
function pickTicks(days: string[], granularity: Granularity): string[] {
  if (days.length === 0) return []
  if (granularity === 'weekday') return days

  if (granularity === 'month') {
    const firstOfMonth = days.filter((day) => day.slice(8, 10) === '01')
    const step = Math.ceil(firstOfMonth.length / 12)
    return step <= 1 ? firstOfMonth : firstOfMonth.filter((_, i) => i % step === 0)
  }

  return evenTicks(days, 10)
}

/**
 * `count` labels spread evenly over the series, both ends landing exactly on
 * the first and last day.
 *
 * Stepping forward by a fixed stride and then tacking the last day on is what
 * the naive version did, and on a 31-day month it ended "… 25 · 29 · 31":
 * every gap four days wide except the final one, which is two. Interpolating
 * the positions instead keeps the spacing even all the way across.
 */
function evenTicks(days: string[], count: number): string[] {
  const wanted = Math.min(days.length, count)
  if (wanted <= 1) return days.slice(0, 1)
  const out: string[] = []
  for (let i = 0; i < wanted; i++) {
    const day = days[Math.round((i * (days.length - 1)) / (wanted - 1))]
    if (out[out.length - 1] !== day) out.push(day)
  }
  return out
}

/** Day and month, always both — for labels that stand on their own. */
export function shortLabel(day: string, months: string[]): string {
  const d = parseDay(day)
  return d ? `${d.getDate()} ${months[d.getMonth()]}` : day
}

/** Sums here run to nine digits; the axis has room for four. */
export function compactMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(Math.round(value))
}

export interface DayAxis {
  granularity: Granularity
  ticks: string[]
  /** Axis label per ticked day, as one or two stacked lines. */
  lines: (day: string) => string[]
  /** The unabbreviated date, for the tooltip and the subtitle. */
  fullLabel: (day: string) => string
  shortLabel: (day: string) => string
  average: number
  best: DayPoint | null
}

/**
 * Every label names its month ("8 avg", never a bare "8"); the short ranges add the
 * weekday on a second line; a multi-year series adds the year.
 */
export function dayAxis(data: DayPoint[], lang: string): DayAxis {
  const months = pickLocale(MONTHS_SHORT, lang)
  const weekdays = pickLocale(WEEKDAYS_SHORT, lang)
  const days = data.map((p) => p.day)
  const granularity = granularityFor(days)
  const multiYear = days.some((d) => d.slice(0, 4) !== days[0].slice(0, 4))
  const ticks = pickTicks(days, granularity)
  const labelFor = (day: string) => {
    const d = parseDay(day)
    if (!d) return [day]
    const month = `${months[d.getMonth()]}${multiYear ? ` '${String(d.getFullYear()).slice(2)}` : ''}`
    if (granularity === 'month') return [month]
    return granularity === 'weekday' ? [`${d.getDate()} ${month}`, weekdays[d.getDay()]] : [`${d.getDate()} ${month}`]
  }
  const labels = new Map(ticks.map((day) => [day, labelFor(day)]))
  const total = data.reduce((sum, p) => sum + p.revenue, 0)
  return {
    granularity,
    ticks,
    lines: (day) => labels.get(day) ?? [shortLabel(day, months)],
    fullLabel: (day) => {
      const d = parseDay(day)
      return d ? `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}` : day
    },
    shortLabel: (day) => shortLabel(day, months),
    average: days.length > 0 ? total / days.length : 0,
    best: data.reduce<DayPoint | null>((top, p) => (top === null || p.revenue > top.revenue ? p : top), null),
  }
}
