'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'

/**
 * Period selector for the reports overview: quick presets plus a custom
 * date/time range.
 *
 * Split out of AnalyticsClient so it can sit in the page header row beside the
 * title and the tabs rather than forming a band of its own beneath them. The
 * committed period is owned by the parent; this component keeps only the
 * popover's draft values, so a half-entered range never becomes the applied
 * one.
 */

export interface PeriodValue {
  period: string
  customStart: string
  customEnd: string
}

export const PERIOD_PRESETS = [
  'today', 'yesterday', 'week', 'month', 'thisMonth', 'lastMonth', 'all',
] as const

const formatDateISO = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The date range a preset stands for. One function, used both to preview and
 * to commit — the two used to be written out separately and had already
 * drifted (the 30-day preset started at 00:05 when committed but 00:00 in the
 * draft, so the same button produced two different ranges).
 */
function presetRange(preset: string): { start: string; end: string } | null {
  const today = new Date()
  const dayStart = (d: Date) => `${formatDateISO(d)}T00:00`
  const dayEnd = (d: Date) => `${formatDateISO(d)}T23:59`

  switch (preset) {
    case 'today':
      return { start: dayStart(today), end: dayEnd(today) }
    case 'yesterday': {
      const yesterday = subDays(today, 1)
      return { start: dayStart(yesterday), end: dayEnd(yesterday) }
    }
    case 'week':
      return { start: dayStart(subDays(today, 7)), end: dayEnd(today) }
    case 'month':
      return { start: dayStart(subDays(today, 30)), end: dayEnd(today) }
    case 'thisMonth':
      return { start: dayStart(startOfMonth(today)), end: dayEnd(today) }
    case 'lastMonth': {
      const lastMonth = subMonths(today, 1)
      return { start: dayStart(startOfMonth(lastMonth)), end: dayEnd(endOfMonth(lastMonth)) }
    }
    // "All time" has no bounds; the caller ignores the range for it.
    default:
      return null
  }
}

export function PeriodFilter({
  value,
  onChange,
}: {
  value: PeriodValue
  onChange: (next: PeriodValue) => void
}) {
  const t = useTranslations('analytics')
  const { period, customStart, customEnd } = value

  const [isOpen, setIsOpen] = useState(false)
  const [tempMode, setTempMode] = useState<'single' | 'range'>('range')
  const [tempSingleDate, setTempSingleDate] = useState<string>(() => formatDateISO(new Date()))
  const [tempSingleStartHour, setTempSingleStartHour] = useState<string>('00:00')
  const [tempSingleEndHour, setTempSingleEndHour] = useState<string>('23:59')
  const [tempStartDateVal, setTempStartDateVal] = useState<string>(() => formatDateISO(new Date()))
  const [tempStartTimeVal, setTempStartTimeVal] = useState<string>('00:00')
  const [tempEndDateVal, setTempEndDateVal] = useState<string>(() => formatDateISO(new Date()))
  const [tempEndTimeVal, setTempEndTimeVal] = useState<string>('23:59')

  const PRESETS = PERIOD_PRESETS.map((preset) => ({
    value: preset as string,
    label: t(`presets.${preset}`),
  }))

  const getPeriodDisplayLabel = () => {
    if (period !== 'custom') return t(`presets.${period}`)
    const parseDT = (str: string) => {
      if (!str) return { date: '—', time: '—' }
      const [datePart, timePart = '00:00'] = str.split('T')
      const parts = datePart.split('-')
      return {
        date: parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : datePart,
        time: timePart,
      }
    }
    const s = parseDT(customStart)
    const e = parseDT(customEnd)
    return s.date === e.date
      ? `${s.date} ${s.time} - ${e.time}`
      : `${s.date} ${s.time} - ${e.date} ${e.time}`
  }

  const handlePresetClick = (preset: string) => {
    const range = presetRange(preset)
    onChange({
      period: preset,
      // "All time" ignores the range, so leave the previous one intact rather
      // than overwriting what the user last set in the custom picker.
      customStart: range?.start ?? customStart,
      customEnd: range?.end ?? customEnd,
    })
    setIsOpen(false)
  }

  const handleApply = () => {
    const start = tempMode === 'single'
      ? `${tempSingleDate}T${tempSingleStartHour}`
      : `${tempStartDateVal}T${tempStartTimeVal}`
    const end = tempMode === 'single'
      ? `${tempSingleDate}T${tempSingleEndHour}`
      : `${tempEndDateVal}T${tempEndTimeVal}`

    onChange({ period: 'custom', customStart: start, customEnd: end })
    setIsOpen(false)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) return

    // Seed the draft from what is currently applied, so opening the picker
    // shows the range in force rather than today's date.
    const [startDate = formatDateISO(new Date()), startTime = '00:00'] = customStart.split('T')
    const [endDate = formatDateISO(new Date()), endTime = '23:59'] = customEnd.split('T')

    setTempStartDateVal(startDate)
    setTempStartTimeVal(startTime)
    setTempEndDateVal(endDate)
    setTempEndTimeVal(endTime)

    // A range inside one day is really a single-day pick with two times.
    if (startDate === endDate) {
      setTempMode('single')
      setTempSingleDate(startDate)
      setTempSingleStartHour(startTime)
      setTempSingleEndHour(endTime)
    } else {
      setTempMode('range')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick presets inline - scrollable horizontally on mobile */}
      <div className="flex items-center gap-1 bg-slate-50/75 dark:bg-slate-800/75 p-1 rounded-xl border border-slate-100/80 dark:border-slate-700/80 overflow-x-auto scrollbar-none w-full sm:w-auto">
        {PRESETS.filter((p) => p.value !== 'custom').map((p) => {
          const active = period === p.value
          return (
            <button
              key={p.value}
              onClick={() => handlePresetClick(p.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                active
                  ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-xs border border-slate-200/50 dark:border-slate-600'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-700/40'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      
      {/* Custom Date Range selector */}
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <button
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 shadow-xs cursor-pointer h-[38px] w-full sm:w-auto justify-center sm:justify-start ${
                period === 'custom'
                  ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/50 text-violet-700 dark:text-violet-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Calendar className={`h-4 w-4 ${period === 'custom' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`} />
              <span>
                {period === 'custom' ? getPeriodDisplayLabel() : t('presets.custom')}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
          }
        />
        <PopoverContent align="end" className="w-[360px] p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden flex flex-col gap-4">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {t('customFilter.title')}
            </h4>
      
            {/* Mode Selector */}
            <div className="grid grid-cols-2 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl">
              <button
                type="button"
                onClick={() => setTempMode('single')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tempMode === 'single' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-xs border border-slate-200/50 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
              >
                {t('customFilter.singleDay')}
              </button>
              <button
                type="button"
                onClick={() => setTempMode('range')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tempMode === 'range' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-xs border border-slate-200/50 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
              >
                {t('customFilter.dateRange')}
              </button>
            </div>
      
            {/* Date Inputs depending on tempMode */}
            {tempMode === 'single' ? (
              <div className="space-y-3 pt-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t('customFilter.date')}
                  </span>
                  <input
                    type="date"
                    value={tempSingleDate}
                    onChange={(e) => setTempSingleDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all dark:scheme-dark"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {t('customFilter.startTime')}
                    </span>
                    <input
                      type="time"
                      value={tempSingleStartHour}
                      onChange={(e) => setTempSingleStartHour(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all dark:scheme-dark"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {t('customFilter.endTime')}
                    </span>
                    <input
                      type="time"
                      value={tempSingleEndHour}
                      onChange={(e) => setTempSingleEndHour(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all dark:scheme-dark"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t('customFilter.startDateTime')}
                  </span>
                  <div className="grid grid-cols-5 gap-2">
                    <input
                      type="date"
                      value={tempStartDateVal}
                      onChange={(e) => setTempStartDateVal(e.target.value)}
                      className="col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all dark:scheme-dark"
                    />
                    <input
                      type="time"
                      value={tempStartTimeVal}
                      onChange={(e) => setTempStartTimeVal(e.target.value)}
                      className="col-span-2 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all dark:scheme-dark"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t('customFilter.endDateTime')}
                  </span>
                  <div className="grid grid-cols-5 gap-2">
                    <input
                      type="date"
                      value={tempEndDateVal}
                      onChange={(e) => setTempEndDateVal(e.target.value)}
                      className="col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all dark:scheme-dark"
                    />
                    <input
                      type="time"
                      value={tempEndTimeVal}
                      onChange={(e) => setTempEndTimeVal(e.target.value)}
                      className="col-span-2 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all dark:scheme-dark"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
      
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={handleApply}
              className="px-3.5 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all shadow-sm cursor-pointer"
            >
              {t('customFilter.confirm')}
            </button>
          </div>
        </PopoverContent>
      </Popover>    </div>
  )
}
