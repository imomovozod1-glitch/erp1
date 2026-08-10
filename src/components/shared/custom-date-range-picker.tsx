'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const formatDateISO = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface CustomDateRangePickerProps {
  /** Whether the "custom" preset is the one currently active (drives the trigger's highlighted state). */
  isActive: boolean
  /** Current custom start/end as "YYYY-MM-DDTHH:mm", used to prefill the picker and render the active-state label. */
  start: string
  end: string
  /** Called with the new "YYYY-MM-DDTHH:mm" start/end once the user confirms. */
  onApply: (start: string, end: string) => void
}

/**
 * The single-day / date-range picker popover, shared between the Analytics page
 * and the Dashboard so both offer the exact same custom time filter.
 */
export function CustomDateRangePicker({ isActive, start, end, onApply }: CustomDateRangePickerProps) {
  const t = useTranslations('analytics')
  const [isOpen, setIsOpen] = useState(false)

  const [tempMode, setTempMode] = useState<'single' | 'range'>('range')
  const [tempSingleDate, setTempSingleDate] = useState<string>(() => formatDateISO(new Date()))
  const [tempSingleStartHour, setTempSingleStartHour] = useState<string>('00:00')
  const [tempSingleEndHour, setTempSingleEndHour] = useState<string>('23:59')

  const [tempStartDateVal, setTempStartDateVal] = useState<string>(() => formatDateISO(new Date()))
  const [tempStartTimeVal, setTempStartTimeVal] = useState<string>('00:00')
  const [tempEndDateVal, setTempEndDateVal] = useState<string>(() => formatDateISO(new Date()))
  const [tempEndTimeVal, setTempEndTimeVal] = useState<string>('23:59')

  const getPeriodDisplayLabel = () => {
    const parseDT = (str: string) => {
      if (!str) return { date: '—', time: '—' }
      const parts = str.split('T')
      const datePart = parts[0]
      const timePart = parts[1] || '00:00'
      const dateSubparts = datePart.split('-')
      const formattedDate = dateSubparts.length === 3 ? `${dateSubparts[2]}.${dateSubparts[1]}.${dateSubparts[0]}` : datePart
      return { date: formattedDate, time: timePart }
    }
    const s = parseDT(start)
    const e = parseDT(end)
    if (s.date === e.date) {
      return `${s.date} ${s.time} - ${e.time}`
    }
    return `${s.date} ${s.time} - ${e.date} ${e.time}`
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      const startParts = start.split('T')
      const endParts = end.split('T')

      const startDate = startParts[0] || formatDateISO(new Date())
      const startTime = startParts[1] || '00:00'
      const endDate = endParts[0] || formatDateISO(new Date())
      const endTime = endParts[1] || '23:59'

      setTempStartDateVal(startDate)
      setTempStartTimeVal(startTime)
      setTempEndDateVal(endDate)
      setTempEndTimeVal(endTime)

      if (startDate === endDate) {
        setTempMode('single')
        setTempSingleDate(startDate)
        setTempSingleStartHour(startTime)
        setTempSingleEndHour(endTime)
      } else {
        setTempMode('range')
      }
    }
  }

  const handleApply = () => {
    let finalStart = ''
    let finalEnd = ''

    if (tempMode === 'single') {
      finalStart = `${tempSingleDate}T${tempSingleStartHour}`
      finalEnd = `${tempSingleDate}T${tempSingleEndHour}`
    } else {
      finalStart = `${tempStartDateVal}T${tempStartTimeVal}`
      finalEnd = `${tempEndDateVal}T${tempEndTimeVal}`
    }

    onApply(finalStart, finalEnd)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold border rounded-xl hover:bg-slate-50 transition-all duration-200 shadow-xs cursor-pointer h-[38px] w-full sm:w-auto justify-center sm:justify-start ${
              isActive
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <Calendar className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>{isActive ? getPeriodDisplayLabel() : t('presets.custom')}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        }
      />
      <PopoverContent align="end" className="w-[360px] p-4 bg-white border border-slate-150 rounded-2xl shadow-xl overflow-hidden flex flex-col gap-4">
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t('customFilter.title')}
          </h4>

          {/* Mode Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl">
            <button
              type="button"
              onClick={() => setTempMode('single')}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tempMode === 'single' ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('customFilter.singleDay')}
            </button>
            <button
              type="button"
              onClick={() => setTempMode('range')}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tempMode === 'range' ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('customFilter.dateRange')}
            </button>
          </div>

          {tempMode === 'single' ? (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('customFilter.date')}
                </span>
                <input
                  type="date"
                  value={tempSingleDate}
                  onChange={(e) => setTempSingleDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('customFilter.startTime')}
                  </span>
                  <input
                    type="time"
                    value={tempSingleStartHour}
                    onChange={(e) => setTempSingleStartHour(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('customFilter.endTime')}
                  </span>
                  <input
                    type="time"
                    value={tempSingleEndHour}
                    onChange={(e) => setTempSingleEndHour(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('customFilter.startDateTime')}
                </span>
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="date"
                    value={tempStartDateVal}
                    onChange={(e) => setTempStartDateVal(e.target.value)}
                    className="col-span-3 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <input
                    type="time"
                    value={tempStartTimeVal}
                    onChange={(e) => setTempStartTimeVal(e.target.value)}
                    className="col-span-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('customFilter.endDateTime')}
                </span>
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="date"
                    value={tempEndDateVal}
                    onChange={(e) => setTempEndDateVal(e.target.value)}
                    className="col-span-3 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <input
                    type="time"
                    value={tempEndTimeVal}
                    onChange={(e) => setTempEndTimeVal(e.target.value)}
                    className="col-span-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleApply}
            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg transition-all shadow-sm cursor-pointer"
          >
            {t('customFilter.confirm')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
