'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCloseOnScroll } from '@/lib/hooks/use-close-on-scroll'
import { cn } from '@/lib/utils'

/**
 * The one date/time range picker in the app.
 *
 * Every page that filters by period uses this popover — the dashboard, the
 * finance cashbox, transactions, an employee's detail page and the reports
 * overview — so the custom-range experience is identical everywhere and there
 * is a single place to change it.
 *
 * Both halves are the app's own controls rather than native
 * `<input type="date">` / `<input type="time">`: those render differently in
 * every browser, cannot be localised, and open a picker that belongs to the
 * platform rather than to this design. The fields here are DatePicker and
 * TimePicker, the same primitives every form uses.
 */

const formatDateISO = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `DD.MM.YYYY` — how a date is read aloud here, not the ISO the value carries. */
function displayDate(iso: string): string {
  const parts = iso.split('-')
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : iso
}

interface CustomDateRangePickerProps {
  /** Whether the "custom" preset is the one currently active (drives the trigger's highlighted state). */
  isActive: boolean
  /** Current custom start/end as "YYYY-MM-DDTHH:mm", used to prefill the picker and render the active-state label. */
  start: string
  end: string
  /** Called with the new "YYYY-MM-DDTHH:mm" start/end once the user confirms. */
  onApply: (start: string, end: string) => void
  /** Locale for the calendar's month and weekday names. */
  lang?: string
  className?: string
}

const fieldLabelClass =
  'text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'

export function CustomDateRangePicker({
  isActive, start, end, onApply, lang, className,
}: CustomDateRangePickerProps) {
  const t = useTranslations('analytics')
  const tCommon = useTranslations('common')
  const [isOpen, setIsOpen] = useState(false)
  useCloseOnScroll(isOpen, () => setIsOpen(false))

  const [mode, setMode] = useState<'single' | 'range'>('range')
  const [singleDate, setSingleDate] = useState<string>(() => formatDateISO(new Date()))
  const [startDate, setStartDate] = useState<string>(() => formatDateISO(new Date()))
  const [endDate, setEndDate] = useState<string>(() => formatDateISO(new Date()))
  const [startTime, setStartTime] = useState('00:00')
  const [endTime, setEndTime] = useState('23:59')

  const triggerLabel = () => {
    if (!isActive) return t('presets.custom')
    const [sDate, sTime = '00:00'] = start.split('T')
    const [eDate, eTime = '23:59'] = end.split('T')
    return sDate === eDate
      ? `${displayDate(sDate)} ${sTime} – ${eTime}`
      : `${displayDate(sDate)} ${sTime} – ${displayDate(eDate)} ${eTime}`
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) return

    // Seed the draft from what is applied, so opening shows the range in force
    // rather than today's date.
    const [sDate = formatDateISO(new Date()), sTime = '00:00'] = start.split('T')
    const [eDate = formatDateISO(new Date()), eTime = '23:59'] = end.split('T')

    setStartDate(sDate)
    setEndDate(eDate)
    setStartTime(sTime)
    setEndTime(eTime)

    // A range inside a single day is really a one-day pick with two times.
    if (sDate === eDate) {
      setMode('single')
      setSingleDate(sDate)
    } else {
      setMode('range')
    }
  }

  const handleApply = () => {
    if (mode === 'single') {
      onApply(`${singleDate}T${startTime}`, `${singleDate}T${endTime}`)
    } else {
      // Guard the inverted case rather than emitting a range that ends before
      // it begins — every consumer filters with start <= row <= end and would
      // silently return nothing.
      const from = `${startDate}T${startTime}`
      const to = `${endDate}T${endTime}`
      onApply(from <= to ? from : to, from <= to ? to : from)
    }
    setIsOpen(false)
  }

  const modeButton = (value: 'single' | 'range', label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={cn(
        'rounded-lg py-1.5 text-xs font-semibold transition-all',
        mode === value
          ? 'bg-white text-violet-600 shadow-xs dark:bg-slate-700 dark:text-violet-400'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
      )}
    >
      {label}
    </button>
  )

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              'flex h-[38px] w-full items-center justify-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-all duration-200 sm:w-auto sm:justify-start',
              isActive
                ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-400'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
              className
            )}
          />
        }
      >
        <CalendarDays className={cn('h-4 w-4', isActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400')} />
        <span className="tabular-nums">{triggerLabel()}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="flex w-[320px] flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          {t('customFilter.title')}
        </h4>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/80">
          {modeButton('single', t('customFilter.singleDay'))}
          {modeButton('range', t('customFilter.dateRange'))}
        </div>

        {/* Date fields, not an always-open calendar: the popover stays small
            and the calendar appears only when a field is clicked. DatePicker is
            reused verbatim so these behave exactly like every date field in the
            app's forms, month/year dropdowns included. */}
        {mode === 'single' ? (
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>{t('customFilter.date')}</span>
            <DatePicker value={singleDate} onChange={setSingleDate} lang={lang} />
          </label>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={fieldLabelClass}>{t('customFilter.startDate')}</span>
              <DatePicker value={startDate} onChange={setStartDate} lang={lang} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={fieldLabelClass}>{t('customFilter.endDate')}</span>
              <DatePicker value={endDate} onChange={setEndDate} lang={lang} />
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>{t('customFilter.startTime')}</span>
            <TimePicker
              value={startTime}
              onChange={setStartTime}
              hourLabel={tCommon('hour')}
              minuteLabel={tCommon('minute')}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>{t('customFilter.endTime')}</span>
            <TimePicker
              value={endTime}
              onChange={setEndTime}
              hourLabel={tCommon('hour')}
              minuteLabel={tCommon('minute')}
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <span className="text-[11px] tabular-nums text-slate-400">
            {mode === 'single'
              ? displayDate(singleDate)
              : `${displayDate(startDate)} – ${displayDate(endDate)}`}
          </span>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-700"
          >
            {t('customFilter.confirm')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
