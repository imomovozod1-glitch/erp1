'use client'

import { useEffect, useRef, useState } from 'react'
import { ClockIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCloseOnScroll } from '@/lib/hooks/use-close-on-scroll'
import { cn } from '@/lib/utils'

/**
 * Time field: an input-looking trigger that opens hour and minute lists.
 *
 * Composed the same way as DatePicker (Popover + trigger button styled as an
 * input), so a time field and a date field beside it read as one control pair.
 *
 * Replaces `<input type="time">`, which looked different in every browser, put
 * its own picker UI outside the app's design, and could not be operated at all
 * on some Android WebViews — the platform the Capacitor shell runs on.
 */

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))

/** Split "HH:mm" defensively — a malformed stored value must not blank the field. */
function parseTime(value: string): { hour: string; minute: string } {
  const [h = '', m = ''] = (value ?? '').split(':')
  const hour = /^\d{1,2}$/.test(h) && Number(h) < 24 ? h.padStart(2, '0') : '00'
  const minute = /^\d{1,2}$/.test(m) && Number(m) < 60 ? m.padStart(2, '0') : '00'
  return { hour, minute }
}

/** Scrolls the selected row into view whenever the list is (re)opened. */
function useScrollToSelected(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    // Deferred a tick: the popover content mounts after this effect runs, so
    // the selected row has no layout to scroll to yet.
    const timer = setTimeout(() => {
      ref.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' })
    }, 0)
    return () => clearTimeout(timer)
  }, [open])
  return ref
}

interface TimePickerProps {
  id?: string
  /** "HH:mm". */
  value: string
  onChange: (value: string) => void
  /** Minute granularity; 1 lists every minute, 5 lists 00/05/10… */
  minuteStep?: number
  /**
   * Column headings. Passed in rather than translated here: this is a `ui/`
   * primitive, and the ones that carry text take it as props (see
   * PasswordInput's showLabel/hideLabel) so they stay free of a namespace.
   */
  hourLabel?: string
  minuteLabel?: string
  disabled?: boolean
  className?: string
}

export function TimePicker({
  id, value, onChange, minuteStep = 1,
  hourLabel = 'Hour', minuteLabel = 'Min',
  disabled, className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const { hour, minute } = parseTime(value)
  useCloseOnScroll(open, () => setOpen(false))
  const listRef = useScrollToSelected(open)

  const minutes = Array.from(
    { length: Math.ceil(60 / Math.max(1, minuteStep)) },
    (_, i) => String(i * Math.max(1, minuteStep)).padStart(2, '0')
  )
  // A stored value off the step grid (08:07 with step 5) must still be
  // selectable, or opening the picker would silently change the time.
  if (!minutes.includes(minute)) {
    minutes.push(minute)
    minutes.sort()
  }

  const column = (
    items: string[],
    selected: string,
    onPick: (next: string) => void,
    label: string
  ) => (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="max-h-48 overflow-y-auto pr-1">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            data-selected={item === selected}
            onClick={() => onPick(item)}
            className={cn(
              'w-full rounded-md px-2 py-1.5 text-center text-sm tabular-nums transition-colors',
              item === selected
                ? 'bg-violet-600 font-semibold text-white'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            id={id}
            type="button"
            disabled={disabled}
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-normal shadow-xs transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
          />
        }
      >
        <ClockIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left tabular-nums">{`${hour}:${minute}`}</span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-44 p-2">
        <div ref={listRef} className="flex gap-1">
          {column(HOURS, hour, (h) => onChange(`${h}:${minute}`), hourLabel)}
          <div className="w-px shrink-0 bg-border" />
          {column(minutes, minute, (m) => onChange(`${hour}:${m}`), minuteLabel)}
        </div>
      </PopoverContent>
    </Popover>
  )
}
