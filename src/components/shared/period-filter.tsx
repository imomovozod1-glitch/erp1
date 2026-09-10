'use client'

import { useTranslations } from 'next-intl'
import { subDays, startOfMonth, endOfMonth, subMonths, startOfWeek } from 'date-fns'
import { CustomDateRangePicker } from '@/components/shared/custom-date-range-picker'
import { cn } from '@/lib/utils'

export type Period = string

export interface PeriodPreset {
  value: string
  label: string
}

interface PeriodFilterProps {
  period: Period
  onPeriodChange: (period: Period) => void
  customStart: string
  customEnd: string
  onApplyCustomRange: (start: string, end: string) => void
  /**
   * Presets to offer. Defaults to the dashboard's five. Pass your own where the
   * page means something different by them — "week" is *this* week on the
   * dashboard but a rolling 7 days in reports, and a shared label would be
   * wrong on one of the two.
   */
  presets?: PeriodPreset[]
  /** Locale for the custom picker's calendar. */
  lang?: string
  className?: string
}

/**
 * Preset pills plus the shared custom-range popover — the period filter used
 * across the app. Purely controlled (no internal state or persistence) so each
 * page keeps owning its own filtering logic; this only holds the markup, and
 * is meant to be dropped into PageHeader's `children` slot so the filter sits
 * on the page-title row.
 */
export function PeriodFilter({
  period, onPeriodChange, customStart, customEnd, onApplyCustomRange,
  presets, lang, className,
}: PeriodFilterProps) {
  const tDash = useTranslations('dashboard')

  const items: PeriodPreset[] =
    presets ??
    (['today', 'yesterday', 'week', 'month', 'all'] as const).map((value) => ({
      value,
      label: tDash(value),
    }))

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex rounded-lg border bg-slate-100 p-0.5 shadow-inner dark:bg-slate-800">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onPeriodChange(item.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200',
              period === item.value
                ? 'bg-white text-violet-600 shadow-sm dark:bg-slate-700 dark:text-violet-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <CustomDateRangePicker
        isActive={period === 'custom'}
        start={customStart}
        end={customEnd}
        onApply={onApplyCustomRange}
        lang={lang}
      />
    </div>
  )
}

/**
 * The date range a preset stands for, as `YYYY-MM-DDTHH:mm`. Returns null for
 * presets with no bounds ("all"), which callers treat as "don't filter".
 *
 * Exported so pages stop hand-rolling this per screen — the reports overview
 * previously wrote the same six branches twice in one file and the two copies
 * had already drifted apart.
 */
export function presetRange(preset: string): { start: string; end: string } | null {
  const today = new Date()
  const iso = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const dayStart = (d: Date) => `${iso(d)}T00:00`
  const dayEnd = (d: Date) => `${iso(d)}T23:59`

  switch (preset) {
    case 'today':
      return { start: dayStart(today), end: dayEnd(today) }
    case 'yesterday': {
      const yesterday = subDays(today, 1)
      return { start: dayStart(yesterday), end: dayEnd(yesterday) }
    }
    // Rolling windows, matching the "Oxirgi 7/30 kun" labels in the analytics
    // namespace.
    case 'week':
      return { start: dayStart(subDays(today, 7)), end: dayEnd(today) }
    case 'month':
      return { start: dayStart(subDays(today, 30)), end: dayEnd(today) }
    // Calendar windows, matching the dashboard's "Shu hafta / Shu oy".
    case 'thisWeek':
      return { start: dayStart(startOfWeek(today, { weekStartsOn: 1 })), end: dayEnd(today) }
    case 'thisMonth':
      return { start: dayStart(startOfMonth(today)), end: dayEnd(today) }
    case 'lastMonth': {
      const lastMonth = subMonths(today, 1)
      return { start: dayStart(startOfMonth(lastMonth)), end: dayEnd(endOfMonth(lastMonth)) }
    }
    default:
      return null
  }
}
