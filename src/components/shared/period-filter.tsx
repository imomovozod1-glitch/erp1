'use client'

import { useTranslations } from 'next-intl'
import { subDays, startOfMonth, endOfMonth, subMonths, startOfWeek } from 'date-fns'
import { CalendarRange, Check, ChevronDown } from 'lucide-react'
import { CustomDateRangePicker } from '@/components/shared/custom-date-range-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
 * The period filter used across the app: one small control that names the
 * period in force, plus the shared custom-range popover.
 *
 * It used to lay every preset out as a pill. Five or six of them on the
 * page-title row is a strip wider than most page titles — and on a phone it
 * wrapped onto two lines above the content it filtered, which is a lot of
 * furniture for a setting that is read far more often than it is changed. The
 * presets moved into a menu; what stayed on screen is the answer ("Oy"), not
 * the question.
 *
 * Purely controlled (no internal state or persistence) so each page keeps
 * owning its own filtering logic; this only holds the markup, and is meant to
 * be dropped into PageHeader's `children` slot.
 */
export function PeriodFilter({
  period, onPeriodChange, customStart, customEnd, onApplyCustomRange,
  presets, lang, className,
}: PeriodFilterProps) {
  const tDash = useTranslations('dashboard')
  // The picker beside it already labels the custom case from this namespace —
  // same word, one source (analytics.presets.custom).
  const tPresets = useTranslations('analytics.presets')

  const items: PeriodPreset[] =
    presets ??
    (['today', 'yesterday', 'week', 'month', 'all'] as const).map((value) => ({
      value,
      label: tDash(value),
    }))

  const active = items.find((item) => item.value === period)
  // 'custom' is not one of the presets: while a range is in force the trigger
  // says so, and the range itself is spelled out on the picker beside it.
  const activeLabel = active?.label ?? tPresets('custom')

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex h-[38px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            />
          }
        >
          <CalendarRange className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          {activeLabel}
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          {items.map((item) => (
            <DropdownMenuItem key={item.value} onClick={() => onPeriodChange(item.value)}>
              <Check
                className={cn(
                  'mr-2 h-3.5 w-3.5',
                  period === item.value ? 'text-violet-600 dark:text-violet-400' : 'opacity-0'
                )}
              />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
