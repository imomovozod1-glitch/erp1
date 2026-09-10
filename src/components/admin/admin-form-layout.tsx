import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Layout primitives for the super-admin forms.
 *
 * These forms used to be a single column capped at `max-w-3xl`, which on an
 * admin console — a desktop tool, usually on a wide screen — left more than
 * half the viewport empty while the fields themselves stayed cramped. The
 * shape here is the one settings screens converge on: each section puts its
 * heading and a line of explanation in a fixed left column and its fields in a
 * grid on the right. The width gets used for structure rather than for
 * stretching inputs to 900px.
 */

export function AdminFormShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className
      )}
    >
      {children}
    </div>
  )
}

export function AdminFormSection({
  icon: Icon,
  title,
  description,
  /** Fields per row on a wide screen; a section of long inputs wants fewer. */
  columns = 2,
  children,
}: {
  icon: LucideIcon
  title: string
  description?: string
  columns?: 1 | 2 | 3
  children: ReactNode
}) {
  return (
    <section className="grid gap-5 border-b border-slate-100 px-6 py-7 last:border-0 lg:grid-cols-[17rem_1fr] lg:gap-10 dark:border-slate-800">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      <div
        className={cn(
          'grid gap-x-5 gap-y-4 self-start',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3'
        )}
      >
        {children}
      </div>
    </section>
  )
}

/**
 * Action bar pinned to the bottom of the viewport. On a form this long the
 * submit button was previously reachable only after scrolling to the end.
 */
export function AdminFormActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-white/85 px-6 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/85">
      {children}
    </div>
  )
}

/** One labelled field. `wide` makes it span the whole row (textareas, pickers). */
export function AdminField({
  wide,
  children,
  className,
}: {
  wide?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5 min-w-0', wide && 'sm:col-span-2 2xl:col-span-3', className)}>
      {children}
    </div>
  )
}
