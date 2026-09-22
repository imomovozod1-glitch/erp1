'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { NumericInput } from '@/components/ui/numeric-input'
import { cn } from '@/lib/utils'

export const LICENSE_COUNT_PRESETS = [1, 5, 10, 25, 50]
export const DURATION_PRESETS = [1, 3, 6, 12]

/** `YYYY-MM-DD` plus `months` calendar months. */
// Calendar arithmetic lives in src/lib/subscription.ts — the console's preview
// and the API that stores the date have to agree to the day, and the copy that
// used to live here disagreed with itself at every month end.
export { addMonths } from '@/lib/subscription'


/**
 * Preset-pill selector with a "custom" fallback — the modern equivalent of a
 * plan/seat-count picker (mirrors the status-filter pill pattern already
 * used in tenants-table.tsx) instead of a bare number field. Falls open to
 * a NumericInput automatically when the current value isn't one of the
 * presets (e.g. editing a tenant that already has a non-standard value).
 */
export function PresetPicker({
  value,
  options,
  onSelect,
  customLabel,
  suffix,
}: {
  value: number | undefined
  options: number[]
  onSelect: (n: number) => void
  customLabel: string
  suffix?: string
}) {
  const [customOpen, setCustomOpen] = useState(value != null && !options.includes(value))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setCustomOpen(false)
              onSelect(n)
            }}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
              !customOpen && value === n
                ? 'bg-violet-600 border-violet-600 text-white'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            )}
          >
            {n}
            {suffix ? ` ${suffix}` : ''}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
            customOpen
              ? 'bg-violet-600 border-violet-600 text-white'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
          )}
        >
          <Pencil className="h-3 w-3" /> {customLabel}
        </button>
      </div>
      {customOpen && (
        <NumericInput
          value={value}
          onChange={(v) => onSelect(typeof v === 'number' ? v : 0)}
          className="w-32"
        />
      )}
    </div>
  )
}
