'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { uz, ru, enUS } from 'react-day-picker/locale'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  const [open, setOpen] = useState(false)
  const selected = parseIsoDate(value)

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
          onSelect={(date) => {
            if (date) {
              onChange(toIsoDate(date))
              setOpen(false)
            }
          }}
          locale={toDayPickerLocale(lang)}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
