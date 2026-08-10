import { cn } from '@/lib/utils'

export type StatusTone = 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'slate'

const TONE_STYLES: Record<StatusTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50',
  slate: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
}

const DOT_STYLES: Record<StatusTone, string> = {
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  slate: 'bg-slate-400',
}

interface StatusBadgeProps {
  label: string
  tone: StatusTone
  /** Small pulsing dot, reserved for "currently active/live" states (e.g. an employee who is actively employed). */
  pulse?: boolean
  className?: string
}

/**
 * The single status-pill design used across the whole app (invoices, orders,
 * purchase orders, transactions, active/inactive states, etc.) so every
 * status reads the same way regardless of which page it's on.
 */
export function StatusBadge({ label, tone, pulse = false, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap',
        TONE_STYLES[tone],
        className
      )}
    >
      {pulse && <span className={cn('w-1.5 h-1.5 rounded-full', DOT_STYLES[tone], pulse && 'animate-pulse')} />}
      {label}
    </span>
  )
}
