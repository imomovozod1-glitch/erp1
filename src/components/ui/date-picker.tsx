'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { useLocale } from 'next-intl'
import { uz, ru, enUS } from 'react-day-picker/locale'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCloseOnScroll } from '@/lib/hooks/use-close-on-scroll'
import { cn, formatDate } from '@/lib/utils'

/**
 * Composed the same way as shadcn/ui's own Date Picker example
 * (Popover + Calendar + trigger button), adapted for this project's Popover
 * (@base-ui/react, not Radix) — the trigger uses the `render` prop instead
 * of `asChild`, matching every other Trigger usage in this codebase.
 */
function toDayPickerLocale(lang?: string) {
  if (lang === 'uz') return uz
  if (lang === 'ru') return ru
  return enUS
}

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface DatePickerProps {
  id?: string
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  lang?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({ id, value, onChange, placeholder, lang, disabled, className }: DatePickerProps) {
  // The calendar speaks the interface language even where a caller did not
  // pass `lang` (the report builder, the report filters).
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const selected = parseIsoDate(value)
  useCloseOnScroll(open, () => setOpen(false))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            id={id}
            type="button"
            disabled={disabled}
            className={cn(
              // The same box as <Input>, so a date sits in a form like any other field.
              'flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-card px-3 text-base font-normal transition-[color,box-shadow,border-color] outline-none hover:border-slate-300 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm dark:bg-input/30 dark:hover:border-slate-600',
              open && 'border-ring ring-4 ring-ring/20',
              !selected && 'text-muted-foreground',
              className
            )}
          />
        }
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left">{selected ? formatDate(value!) : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          // Open on the month being edited. Without this DayPicker starts at
          // today, so changing a 2024 date meant paging back through two years
          // of months before the value was even visible.
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange(toIsoDate(date))
              setOpen(false)
            }
          }}
          locale={toDayPickerLocale(lang ?? locale)}
          autoFocus
          captionLayout="dropdown"
          startMonth={new Date(1920, 0)}
          endMonth={new Date(new Date().getFullYear() + 10, 11)}
        />
      </PopoverContent>
    </Popover>
  )
}
