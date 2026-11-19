'use client'

import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  disabled?: boolean
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
      className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1', disabled && 'opacity-60', className)}
    >
      {options.map((option) => (
        <Segment
          key={option.value}
          label={option.label}
          active={option.value === value}
          disabled={disabled || option.disabled}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}

interface SegmentProps {
  label: string
  active: boolean
  disabled?: boolean
  onSelect: () => void
}

function Segment({ label, active, disabled, onSelect }: SegmentProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'h-7 truncate rounded-lg px-2 text-xs font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 max-md:h-9',
        active
          ? 'bg-card text-violet-700 shadow-sm dark:bg-violet-900/50 dark:text-violet-100'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  )
}
