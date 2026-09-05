'use client'

import { useTranslations } from 'next-intl'
import { CustomDateRangePicker } from '@/components/shared/custom-date-range-picker'

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

interface PeriodFilterProps {
  period: Period
  onPeriodChange: (period: Period) => void
  customStart: string
  customEnd: string
  onApplyCustomRange: (start: string, end: string) => void
}

/**
 * Preset pills (Today/Yesterday/This Week/This Month/All Time) + a custom
 * date-range popover — the same combo already built inline in
 * dashboard-client.tsx and cashbox-client.tsx. Purely controlled (no
 * internal state/sessionStorage of its own) so each page keeps owning its
 * own persistence key and filtering logic; this only extracts the repeated
 * markup, meant to be dropped into PageHeader's `children` slot so the
 * filter sits next to the page title (see AGENTS.md's table-toolbar
 * placement convention).
 */
export function PeriodFilter({ period, onPeriodChange, customStart, customEnd, onApplyCustomRange }: PeriodFilterProps) {
  const tDash = useTranslations('dashboard')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 shadow-inner border">
        {(['today', 'yesterday', 'week', 'month', 'all'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriodChange(p)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
              period === p ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {tDash(p)}
          </button>
        ))}
      </div>
      <CustomDateRangePicker
        isActive={period === 'custom'}
        start={customStart}
        end={customEnd}
        onApply={onApplyCustomRange}
      />
    </div>
  )
}
